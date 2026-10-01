import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('x-request-id');
  const id = header && header.trim().length > 0 ? header.trim().slice(0, 128) : randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
