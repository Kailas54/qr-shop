import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors';
import { idempotencyKeyHeaderSchema } from '../validators/orders';

export function requireIdempotencyKey(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.header('idempotency-key');
  if (!raw) {
    next(new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required'));
    return;
  }

  const parsed = idempotencyKeyHeaderSchema.safeParse(raw);
  if (!parsed.success) {
    next(new HttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key must be 8-128 URL-safe characters'));
    return;
  }

  req.idempotencyKey = parsed.data;
  next();
}
