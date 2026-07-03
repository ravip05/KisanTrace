/**
 * index.ts — Kisan-Trace Server API Entry Point
 *
 * Microservice responsibilities:
 *   - RxDB replication: push/pull sync for scans and users collections
 *   - Health checks for deployment platforms (Render, Railway)
 *
 * NOT responsible for: AI inference (that's on-device), image storage, auth.
 *
 * Run with: npm run dev (ts-node-dev) or npm start (compiled JS)
 */

import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { healthRouter } from './routes/health.route';
import { syncRouter } from './routes/sync.route';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const CORS_ORIGIN = process.env['CORS_ORIGIN'] ?? 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

// CORS — allow the PWA to make requests from its origin
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Parse JSON request bodies (RxDB sends JSON payloads)
app.use(express.json({ limit: '1mb' })); // 1MB limit; sync payloads are small

// Security: remove the X-Powered-By header
app.disable('x-powered-by');

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

app.use('/health', healthRouter);
app.use('/api/sync', syncRouter);

// Catch-all for unknown routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[Kisan-Trace API] Running on http://localhost:${PORT}`);
  console.log(`[Kisan-Trace API] CORS allowed for: ${CORS_ORIGIN}`);
  console.log(`[Kisan-Trace API] Environment: ${process.env['NODE_ENV'] ?? 'development'}`);
});

export default app;
