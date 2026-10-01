import type { AdminRole } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from './errors';
import { parseDurationToMs } from './duration';

export type StaffTokenPayload = {
  sub: string;
  restaurantId: string;
  role: AdminRole;
  email: string;
  type: 'access' | 'refresh';
};

function signToken(payload: StaffTokenPayload, ttl: string): string {
  const expiresIn = Math.floor(parseDurationToMs(ttl) / 1000);
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

export function signAccessToken(admin: {
  id: string;
  restaurantId: string;
  role: AdminRole;
  email: string;
}): string {
  return signToken(
    {
      sub: admin.id,
      restaurantId: admin.restaurantId,
      role: admin.role,
      email: admin.email,
      type: 'access',
    },
    env.JWT_ACCESS_TTL,
  );
}

export function signRefreshToken(admin: {
  id: string;
  restaurantId: string;
  role: AdminRole;
  email: string;
}): string {
  return signToken(
    {
      sub: admin.id,
      restaurantId: admin.restaurantId,
      role: admin.role,
      email: admin.email,
      type: 'refresh',
    },
    env.JWT_REFRESH_TTL,
  );
}

export function verifyStaffToken(token: string, expectedType: 'access' | 'refresh'): StaffTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as StaffTokenPayload;
    if (decoded.type !== expectedType || !decoded.sub || !decoded.restaurantId || !decoded.role) {
      throw new HttpError(401, 'INVALID_TOKEN', 'Invalid token');
    }
    return decoded;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }
}

export function accessTokenMaxAgeSeconds(): number {
  return Math.floor(parseDurationToMs(env.JWT_ACCESS_TTL) / 1000);
}
