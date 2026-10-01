import bcrypt from 'bcrypt';
import { env } from '../config/env';
import { signAccessToken, signRefreshToken, verifyStaffToken } from '../lib/auth';
import { HttpError } from '../lib/errors';
import { prisma } from '../lib/db';

export async function loginStaff(email: string, password: string) {
  const admin = await prisma.admin.findUnique({
    where: { email },
    select: {
      id: true,
      restaurantId: true,
      role: true,
      email: true,
      name: true,
      passwordHash: true,
    },
  });

  if (!admin) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const tokenBase = {
    id: admin.id,
    restaurantId: admin.restaurantId,
    role: admin.role,
    email: admin.email,
  };

  return {
    accessToken: signAccessToken(tokenBase),
    refreshToken: signRefreshToken(tokenBase),
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      restaurantId: admin.restaurantId,
    },
  };
}

export async function refreshStaffSession(refreshToken: string) {
  const payload = verifyStaffToken(refreshToken, 'refresh');
  const admin = await prisma.admin.findUnique({
    where: { id: payload.sub },
    select: { id: true, restaurantId: true, role: true, email: true, name: true },
  });
  if (!admin || admin.restaurantId !== payload.restaurantId) {
    throw new HttpError(401, 'INVALID_TOKEN', 'Invalid or expired token');
  }

  const tokenBase = {
    id: admin.id,
    restaurantId: admin.restaurantId,
    role: admin.role,
    email: admin.email,
  };

  return {
    accessToken: signAccessToken(tokenBase),
    refreshToken: signRefreshToken(tokenBase),
    admin: {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      restaurantId: admin.restaurantId,
    },
  };
}

export async function getStaffProfile(adminId: string) {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      restaurantId: true,
      createdAt: true,
      restaurant: { select: { id: true, name: true, requireStaffOpen: true } },
    },
  });
  if (!admin) {
    throw new HttpError(404, 'NOT_FOUND', 'Staff account not found');
  }
  return admin;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_COST);
}
