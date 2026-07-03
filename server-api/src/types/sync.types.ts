/**
 * sync.types.ts
 *
 * Shared TypeScript types for the RxDB replication protocol.
 *
 * These types mirror the client-side RxDB schema exactly, ensuring that the
 * server's sync endpoint accepts and returns data in the exact shape that
 * the RxDB pull/push replication plugin expects.
 *
 * RxDB Replication Protocol Reference:
 * https://rxdb.info/replication.html
 *
 * The protocol works as follows:
 *   - PUSH: Client → Server. Client sends un-synced documents. Server saves
 *     them and returns any conflicts (for MVP: always empty, LWW strategy).
 *   - PULL: Client → Server (GET). Server returns documents changed after a
 *     given checkpoint. Client applies changes to local DB.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Document Types (must mirror client-side RxDB schemas)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserDoc {
  id: string;           // UUIDv4, primary key
  phoneNumber: string;  // Primary auth for rural users
  locale: string;       // e.g., 'hi-IN'
  createdAt: string;    // ISO 8601 datetime
  // RxDB internal fields added on the server side during sync
  _deleted?: boolean;
  _meta?: { lwt: number };
}

export interface ScanDoc {
  id: string;             // UUIDv7, generated client-side before sync
  userId: string;         // FK to users.id
  cropType: string;       // 'paddy' | 'tomato' | 'groundnut'
  predictedDisease: string;
  confidenceScore: number; // 0.0 – 1.0
  severity: string;       // 'low' | 'moderate' | 'high'
  scannedAt: string;      // ISO 8601 — when the farmer actually scanned (offline)
  syncedAt?: string;      // ISO 8601 — when this record hit the server
  latitude?: number;
  longitude?: number;
  // RxDB internal fields
  _deleted?: boolean;
  _meta?: { lwt: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// RxDB Push Protocol (Client → Server)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single row that the RxDB push replication sends to the server.
 * It includes the new document state and optionally the "assumed master state"
 * (what the client thinks the server has). Used for conflict detection.
 */
export interface RxWriteRow<T> {
  newDocumentState: T;
  assumedMasterState?: T;
}

export interface PushRequestBody<T> {
  documents: RxWriteRow<T>[];
}

/**
 * The server's response to a push request.
 * - On success: an empty conflicts array `[]` (MVP: Last Writer Wins).
 * - On conflict: the server's current state of the conflicting document(s).
 */
export type PushResponseBody<T> = T[]; // conflicting documents, empty for LWW

// ─────────────────────────────────────────────────────────────────────────────
// RxDB Pull Protocol (Server → Client)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checkpoint tracks the last sync position so the server knows which
 * documents to return on the next pull. We use `updatedAt` (server-assigned
 * timestamp) as the checkpoint to avoid gaps from clock skew.
 */
export interface SyncCheckpoint {
  updatedAt: string; // ISO 8601 — last-seen server-side update timestamp
}

export interface PullResponseBody<T> {
  documents: T[];
  checkpoint: SyncCheckpoint | null; // null if no documents returned
}

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'error';
  uptime: number;
  timestamp: string;
  db: 'connected' | 'disconnected';
  version: string;
}
