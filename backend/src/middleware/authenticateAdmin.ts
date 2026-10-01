import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/db';
import { verifyStaffToken } from '../lib/auth';
import { HttpError } from '../lib/errors';

export async function authenticateAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
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
    const payload = verifyStaffToken(token, 'access');
    const admin = await prisma.admin.findUnique({
      where: { id: payload.sub },
      select: { id: true, restaurantId: true, role: true, email: true, name: true },
    });
    if (!admin || admin.restaurantId !== payload.restaurantId) {
      next(new HttpError(401, 'UNAUTHORIZED', 'Staff account not found'));
      return;
    }

    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
}
