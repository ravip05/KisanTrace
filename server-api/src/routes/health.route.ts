/**
 * health.route.ts — GET /health
 *
 * Returns the operational status of the API and its dependencies.
 * Used by:
 *   - Render/Railway healthcheck pings to determine if the container is alive.
 *   - The client PWA to optionally show a "Server unreachable" warning.
 */

import { Router, Request, Response } from 'express';
import { checkDbConnection } from '../db/postgres';
import type { HealthResponse } from '../types/sync.types';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const dbAlive = await checkDbConnection();

  const payload: HealthResponse = {
    status: dbAlive ? 'ok' : 'error',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    db: dbAlive ? 'connected' : 'disconnected',
    version: process.env.npm_package_version ?? '1.0.0',
  };

  const statusCode = dbAlive ? 200 : 503;
  res.status(statusCode).json(payload);
});
