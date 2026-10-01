import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from './errors';

export type GuestTokenPayload = {
  sub: string;
  sessionId: string;
  tableId: string;
  restaurantId: string;
  type: 'guest';
};

export function signGuestSessionToken(input: {
  sessionId: string;
  tableId: string;
  restaurantId: string;
  expiresAt: Date;
}): string {
  const secondsUntilExpiry = Math.floor((input.expiresAt.getTime() - Date.now()) / 1000);
  if (secondsUntilExpiry <= 0) {
    throw new HttpError(400, 'SESSION_EXPIRED', 'Table session has expired');
  }

  const payload: GuestTokenPayload = {
    sub: input.sessionId,
    sessionId: input.sessionId,
    tableId: input.tableId,
    restaurantId: input.restaurantId,
    type: 'guest',
  };

  return jwt.sign(payload, env.GUEST_JWT_SECRET, { expiresIn: secondsUntilExpiry });
}

export function verifyGuestSessionToken(token: string): GuestTokenPayload {
  try {
    const decoded = jwt.verify(token, env.GUEST_JWT_SECRET) as GuestTokenPayload;
    if (decoded.type !== 'guest' || !decoded.sessionId || !decoded.tableId || !decoded.restaurantId) {
      throw new HttpError(401, 'INVALID_TOKEN', 'Invalid guest token');
    }
    return decoded;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, 'INVALID_TOKEN', 'Invalid or expired guest token');
  }
}
