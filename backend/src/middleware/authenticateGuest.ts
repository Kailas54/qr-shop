import type { NextFunction, Request, Response } from 'express';
import { verifyGuestSessionToken } from '../lib/guestAuth';
import { HttpError } from '../lib/errors';
import { loadGuestSessionContext } from '../services/sessionService';

export async function authenticateGuest(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'UNAUTHORIZED', 'Missing or invalid Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    next(new HttpError(401, 'UNAUTHORIZED', 'Missing bearer token'));
    return;
  }

  try {
    const payload = verifyGuestSessionToken(token);
    const context = await loadGuestSessionContext(payload.sessionId);
    if (context.sessionId !== payload.sessionId || context.tableId !== payload.tableId) {
      next(new HttpError(401, 'INVALID_TOKEN', 'Invalid guest token'));
      return;
    }

    req.guestSession = context;
    next();
  } catch (error) {
    next(error);
  }
}
