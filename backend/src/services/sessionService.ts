import { randomBytes } from 'crypto';
import type { SessionStatus, TableSession } from '@prisma/client';
import { env } from '../config/env';
import { signGuestSessionToken } from '../lib/guestAuth';
import { HttpError } from '../lib/errors';
import { generateTablePin, hashPin, verifyPin } from '../lib/pin';
import { notifySessionClosed, notifySessionOpened } from '../lib/pusher';
import { prisma } from '../lib/db';

function sessionExpiryDate(from = new Date()): Date {
  return new Date(from.getTime() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
}

export function isSessionActive(session: Pick<TableSession, 'status' | 'expiresAt'>): boolean {
  return session.status === 'open' && session.expiresAt.getTime() > Date.now();
}

export async function findActiveSessionForTable(tableId: string) {
  const session = await prisma.tableSession.findFirst({
    where: { tableId, status: 'open' },
    orderBy: { openedAt: 'desc' },
  });
  if (!session || !isSessionActive(session)) {
    return null;
  }
  return session;
}

async function assertTableInRestaurant(tableId: string, restaurantId: string) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId, isActive: true },
    select: { id: true, tableNumber: true, restaurantId: true },
  });
  if (!table) {
    throw new HttpError(404, 'NOT_FOUND', 'Table not found');
  }
  return table;
}

export async function openTableSession(restaurantId: string, tableId: string, openedByAdminId: string) {
  const table = await assertTableInRestaurant(tableId, restaurantId);

  const existing = await findActiveSessionForTable(tableId);
  if (existing) {
    throw new HttpError(409, 'SESSION_ALREADY_OPEN', 'This table already has an open session');
  }

  const pin = generateTablePin();
  const pinHash = await hashPin(pin);
  const expiresAt = sessionExpiryDate();

  const session = await prisma.tableSession.create({
    data: {
      tableId,
      pinHash,
      openedBy: openedByAdminId,
      expiresAt,
      status: 'open',
    },
    select: {
      id: true,
      tableId: true,
      openedAt: true,
      expiresAt: true,
      status: true,
      isFlaggedAbusive: true,
    },
  });

  notifySessionOpened(restaurantId, {
    sessionId: session.id,
    tableId: table.id,
    tableNumber: table.tableNumber,
    openedAt: session.openedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  });

  return { session, pin };
}

export async function closeTableSession(restaurantId: string, sessionId: string) {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, table: { restaurantId } },
    select: {
      id: true,
      status: true,
      tableId: true,
      table: { select: { tableNumber: true, restaurantId: true } },
    },
  });
  if (!session) {
    throw new HttpError(404, 'NOT_FOUND', 'Session not found');
  }
  if (session.status === 'closed') {
    throw new HttpError(409, 'SESSION_ALREADY_CLOSED', 'Session is already closed');
  }

  const updated = await prisma.tableSession.update({
    where: { id: sessionId },
    data: { status: 'closed', closedAt: new Date() },
    select: {
      id: true,
      tableId: true,
      status: true,
      closedAt: true,
      openedAt: true,
      expiresAt: true,
    },
  });

  notifySessionClosed(restaurantId, {
    sessionId: updated.id,
    tableId: updated.tableId,
    tableNumber: session.table.tableNumber,
    closedAt: updated.closedAt!.toISOString(),
  });

  return updated;
}

export async function regenerateSessionPin(restaurantId: string, sessionId: string) {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, table: { restaurantId }, status: 'open' },
    select: { id: true, expiresAt: true, status: true },
  });
  if (!session) {
    throw new HttpError(404, 'NOT_FOUND', 'Open session not found');
  }
  if (!isSessionActive(session)) {
    throw new HttpError(409, 'SESSION_EXPIRED', 'Session has expired');
  }

  const pin = generateTablePin();
  const pinHash = await hashPin(pin);
  await prisma.tableSession.update({
    where: { id: sessionId },
    data: { pinHash },
  });

  return { sessionId, pin };
}

export async function flagSessionAbusive(restaurantId: string, sessionId: string) {
  const session = await prisma.tableSession.findFirst({
    where: { id: sessionId, table: { restaurantId } },
    select: { id: true },
  });
  if (!session) {
    throw new HttpError(404, 'NOT_FOUND', 'Session not found');
  }

  return prisma.tableSession.update({
    where: { id: sessionId },
    data: { isFlaggedAbusive: true },
    select: { id: true, isFlaggedAbusive: true, status: true },
  });
}

export async function listRestaurantSessions(restaurantId: string, status?: SessionStatus) {
  return prisma.tableSession.findMany({
    where: {
      table: { restaurantId },
      ...(status ? { status } : {}),
    },
    orderBy: { openedAt: 'desc' },
    select: {
      id: true,
      status: true,
      openedAt: true,
      expiresAt: true,
      closedAt: true,
      isFlaggedAbusive: true,
      table: { select: { id: true, tableNumber: true } },
    },
  });
}

async function createAutoGuestSession(tableId: string) {
  const pinHash = await hashPin(randomBytes(16).toString('hex'));
  const expiresAt = sessionExpiryDate();
  return prisma.tableSession.create({
    data: {
      tableId,
      pinHash,
      openedBy: null,
      expiresAt,
      status: 'open',
    },
  });
}

export async function joinTableSession(qrToken: string, pin?: string) {
  const table = await prisma.table.findFirst({
    where: { qrToken, isActive: true },
    select: {
      id: true,
      tableNumber: true,
      restaurant: { select: { id: true, name: true, requireStaffOpen: true } },
    },
  });
  if (!table) {
    throw new HttpError(404, 'NOT_FOUND', 'Table not found');
  }

  let session = await findActiveSessionForTable(table.id);

  if (table.restaurant.requireStaffOpen) {
    if (!pin) {
      throw new HttpError(400, 'PIN_REQUIRED', 'Enter the PIN from your server');
    }
    if (!session) {
      throw new HttpError(403, 'TABLE_NOT_OPEN', 'This table is not open yet. Please ask the staff.');
    }
    const pinOk = await verifyPin(pin, session.pinHash);
    if (!pinOk) {
      throw new HttpError(401, 'INVALID_PIN', 'Incorrect PIN');
    }
  } else if (!session) {
    session = await createAutoGuestSession(table.id);
  }

  if (!session || !isSessionActive(session)) {
    throw new HttpError(403, 'SESSION_CLOSED', 'This table session is no longer active');
  }

  const accessToken = signGuestSessionToken({
    sessionId: session.id,
    tableId: table.id,
    restaurantId: table.restaurant.id,
    expiresAt: session.expiresAt,
  });

  return {
    accessToken,
    sessionId: session.id,
    expiresAt: session.expiresAt.toISOString(),
    tableNumber: table.tableNumber,
    restaurantName: table.restaurant.name,
  };
}

export async function loadGuestSessionContext(sessionId: string) {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      tableId: true,
      table: {
        select: {
          tableNumber: true,
          restaurantId: true,
          isActive: true,
        },
      },
    },
  });

  if (!session || !session.table.isActive) {
    throw new HttpError(401, 'SESSION_INVALID', 'Table session is not valid');
  }
  if (!isSessionActive(session)) {
    throw new HttpError(401, 'SESSION_CLOSED', 'Table session has ended. Please ask staff for a new PIN.');
  }

  return {
    sessionId: session.id,
    tableId: session.tableId,
    restaurantId: session.table.restaurantId,
    tableNumber: session.table.tableNumber,
    expiresAt: session.expiresAt,
  };
}
