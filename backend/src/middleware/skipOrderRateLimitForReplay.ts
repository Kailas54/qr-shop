import type { NextFunction, Request, Response } from 'express';
import { findOrderByIdempotency } from '../services/orderService';

/** Retries with the same Idempotency-Key must not consume the per-session order rate limit. */
export async function skipOrderRateLimitForReplay(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.guestSession?.sessionId || !req.idempotencyKey) {
    next();
    return;
  }

  try {
    const existing = await findOrderByIdempotency(req.guestSession.sessionId, req.idempotencyKey);
    if (existing) {
      req.skipOrderRateLimit = true;
    }
    next();
  } catch (error) {
    next(error);
  }
}
