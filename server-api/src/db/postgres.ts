/**
 * postgres.ts — PostgreSQL Connection Pool
 *
 * Uses the `pg` library's Pool for efficient connection management.
 * The pool is created once and reused across all request handlers.
 *
 * Edge Case: If the database is unavailable at startup (e.g., cold start on
 * Railway/Render free tier), queries will fail gracefully. The health endpoint
 * will report `db: 'disconnected'` so the client knows not to attempt a sync.
 */

import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== 'test') {
  console.warn('[DB] WARNING: DATABASE_URL not set. Postgres queries will fail.');
}

export const pool = new Pool({
  connectionString,
  // Keep connections alive on free-tier hosts that aggressively close idle connections
  idleTimeoutMillis: 30_000,
  // Maximum connections — keep low for free-tier Postgres limits
  max: 5,
  // Connection timeout
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

/**
 * Checks if the DB is reachable. Used by the /health endpoint.
 */
export async function checkDbConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * SQL schema for reference — run this against your Postgres instance once.
 * In production this would be managed by a migration tool (e.g., Flyway, golang-migrate).
 *
 * CREATE TABLE users (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   phone_number VARCHAR(20) UNIQUE,
 *   locale VARCHAR(10) DEFAULT 'hi-IN',
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 *
 * CREATE TABLE scans (
 *   id UUID PRIMARY KEY,
 *   user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 *   crop_type VARCHAR(50) NOT NULL,
 *   predicted_disease VARCHAR(100),
 *   confidence_score DECIMAL(5,4),
 *   severity VARCHAR(20),
 *   scanned_at TIMESTAMP NOT NULL,
 *   synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   latitude DECIMAL(10,8),
 *   longitude DECIMAL(10,8)
 * );
 *
 * CREATE INDEX idx_scans_user    ON scans(user_id);
 * CREATE INDEX idx_scans_time    ON scans(scanned_at);
 * CREATE INDEX idx_scans_updated ON scans(updated_at); -- used for pull checkpoint
 */
