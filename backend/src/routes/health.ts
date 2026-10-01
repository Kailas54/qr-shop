import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { checkDatabaseConnection } from '../lib/db';

export const healthRouter = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const started = Date.now();
    await checkDatabaseConnection();
    res.json({
      status: 'ok',
      db: 'up',
      latencyMs: Date.now() - started,
    });
  }),
);
