/**
 * sync.route.ts — RxDB Replication Endpoints
 *
 * Implements the RxDB "custom backend" replication protocol for the `scans`
 * and `users` collections.
 *
 * Protocol Summary:
 *   PUSH  POST /api/sync/:collection/push
 *         Client sends un-synced documents. Server upserts and returns conflicts.
 *         MVP strategy: Last Writer Wins (LWW) — conflicts array is always [].
 *
 *   PULL  GET  /api/sync/:collection/pull?checkpoint=<ISO>&limit=<n>
 *         Server returns documents updated after the checkpoint.
 *         Client applies them to local RxDB. Drives incremental sync.
 *
 * RxDB Replication Docs: https://rxdb.info/replication.html
 *
 * Idempotency: PUSH uses `INSERT ... ON CONFLICT DO UPDATE`, so re-sending
 * the same UUIDv7 document is safe — it won't create duplicates.
 * This handles Edge Case 6.4 (Flapping Signal) from TechDesign Section 6.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/postgres';
import type {
  ScanDoc,
  UserDoc,
  PushRequestBody,
  PushResponseBody,
  PullResponseBody,
  SyncCheckpoint,
} from '../types/sync.types';

export const syncRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// SCANS — PUSH
// POST /api/sync/scans/push
// ─────────────────────────────────────────────────────────────────────────────

syncRouter.post('/scans/push', async (req: Request, res: Response) => {
  const body = req.body as PushRequestBody<ScanDoc>;

  if (!body?.documents || !Array.isArray(body.documents)) {
    res.status(400).json({ error: 'Invalid push payload. Expected { documents: [] }' });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of body.documents) {
        const doc = row.newDocumentState;

        if (!doc.id || !doc.userId || !doc.cropType || !doc.scannedAt) {
          // Skip malformed rows — log for debugging but don't fail the batch
          console.warn('[Sync/Scans] Skipping malformed document:', doc.id);
          continue;
        }

        // Idempotent upsert — safe to re-send the same doc (handles flapping network)
        await client.query(
          `INSERT INTO scans (
              id, user_id, crop_type, predicted_disease, confidence_score,
              severity, scanned_at, synced_at, updated_at, latitude, longitude
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8, $9)
            ON CONFLICT (id) DO UPDATE SET
              predicted_disease = EXCLUDED.predicted_disease,
              confidence_score  = EXCLUDED.confidence_score,
              severity          = EXCLUDED.severity,
              synced_at         = NOW(),
              updated_at        = NOW(),
              latitude          = EXCLUDED.latitude,
              longitude         = EXCLUDED.longitude`,
          [
            doc.id,
            doc.userId,
            doc.cropType,
            doc.predictedDisease ?? null,
            doc.confidenceScore ?? null,
            doc.severity ?? null,
            doc.scannedAt,
            doc.latitude ?? null,
            doc.longitude ?? null,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // LWW: no conflicts to report for MVP
    const response: PushResponseBody<ScanDoc> = [];
    res.status(200).json(response);
  } catch (err) {
    console.error('[Sync/Scans/Push] Error:', err);
    res.status(500).json({ error: 'Internal server error during push.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCANS — PULL
// GET /api/sync/scans/pull?checkpoint=<ISO>&limit=<n>
// ─────────────────────────────────────────────────────────────────────────────

syncRouter.get('/scans/pull', async (req: Request, res: Response) => {
  // The checkpoint is the `updatedAt` of the last document the client received.
  // On first pull, checkpoint is absent (client has nothing).
  const checkpointStr = req.query['checkpoint'] as string | undefined;
  const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 200);

  const checkpointDate = checkpointStr ? new Date(checkpointStr) : new Date(0);

  try {
    const result = await pool.query<{
      id: string;
      user_id: string;
      crop_type: string;
      predicted_disease: string | null;
      confidence_score: number | null;
      severity: string | null;
      scanned_at: Date;
      synced_at: Date | null;
      updated_at: Date;
      latitude: number | null;
      longitude: number | null;
    }>(
      `SELECT id, user_id, crop_type, predicted_disease, confidence_score,
              severity, scanned_at, synced_at, updated_at, latitude, longitude
       FROM   scans
       WHERE  updated_at > $1
       ORDER  BY updated_at ASC
       LIMIT  $2`,
      [checkpointDate.toISOString(), limit]
    );

    const documents: ScanDoc[] = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      cropType: row.crop_type,
      predictedDisease: row.predicted_disease ?? '',
      confidenceScore: row.confidence_score ?? 0,
      severity: row.severity ?? '',
      scannedAt: row.scanned_at.toISOString(),
      syncedAt: row.synced_at?.toISOString(),
      latitude: row.latitude ?? undefined,
      longitude: row.longitude ?? undefined,
    }));

    const lastRow = result.rows[result.rows.length - 1];
    const newCheckpoint: SyncCheckpoint | null = lastRow
      ? { updatedAt: lastRow.updated_at.toISOString() }
      : null;

    const response: PullResponseBody<ScanDoc> = {
      documents,
      checkpoint: newCheckpoint,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('[Sync/Scans/Pull] Error:', err);
    res.status(500).json({ error: 'Internal server error during pull.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS — PUSH
// POST /api/sync/users/push
// ─────────────────────────────────────────────────────────────────────────────

syncRouter.post('/users/push', async (req: Request, res: Response) => {
  const body = req.body as PushRequestBody<UserDoc>;

  if (!body?.documents || !Array.isArray(body.documents)) {
    res.status(400).json({ error: 'Invalid push payload. Expected { documents: [] }' });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const row of body.documents) {
        const doc = row.newDocumentState;
        if (!doc.id || !doc.phoneNumber) continue;

        await client.query(
          `INSERT INTO users (id, phone_number, locale, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (id) DO UPDATE SET
             locale     = EXCLUDED.locale,
             updated_at = NOW()`,
          [doc.id, doc.phoneNumber, doc.locale ?? 'hi-IN', doc.createdAt]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const response: PushResponseBody<UserDoc> = [];
    res.status(200).json(response);
  } catch (err) {
    console.error('[Sync/Users/Push] Error:', err);
    res.status(500).json({ error: 'Internal server error during push.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// USERS — PULL
// GET /api/sync/users/pull?checkpoint=<ISO>&limit=<n>
// ─────────────────────────────────────────────────────────────────────────────

syncRouter.get('/users/pull', async (req: Request, res: Response) => {
  const checkpointStr = req.query['checkpoint'] as string | undefined;
  const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 200);
  const checkpointDate = checkpointStr ? new Date(checkpointStr) : new Date(0);

  try {
    const result = await pool.query<{
      id: string;
      phone_number: string;
      locale: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, phone_number, locale, created_at, updated_at
       FROM   users
       WHERE  updated_at > $1
       ORDER  BY updated_at ASC
       LIMIT  $2`,
      [checkpointDate.toISOString(), limit]
    );

    const documents: UserDoc[] = result.rows.map((row) => ({
      id: row.id,
      phoneNumber: row.phone_number,
      locale: row.locale,
      createdAt: row.created_at.toISOString(),
    }));

    const lastRow = result.rows[result.rows.length - 1];
    const newCheckpoint: SyncCheckpoint | null = lastRow
      ? { updatedAt: lastRow.updated_at.toISOString() }
      : null;

    const response: PullResponseBody<UserDoc> = {
      documents,
      checkpoint: newCheckpoint,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('[Sync/Users/Pull] Error:', err);
    res.status(500).json({ error: 'Internal server error during pull.' });
  }
});
