import type { SessionStatus } from '@prisma/client';
import { asyncHandler } from '../lib/asyncHandler';
import {
  closeTableSession,
  flagSessionAbusive,
  joinTableSession,
  listRestaurantSessions,
  openTableSession,
  regenerateSessionPin,
} from '../services/sessionService';
import { getPublicTableByQrToken } from '../services/publicTableService';

export const listAdminSessions = asyncHandler(async (req, res) => {
  const status = req.query.status as SessionStatus | undefined;
  const sessions = await listRestaurantSessions(req.admin!.restaurantId, status);
  res.json({ sessions });
});

export const openSessionForTable = asyncHandler(async (req, res) => {
  const result = await openTableSession(req.admin!.restaurantId, req.params.id, req.admin!.id);
  res.status(201).json({
    session: result.session,
    pin: result.pin,
  });
});

export const closeSession = asyncHandler(async (req, res) => {
  const session = await closeTableSession(req.admin!.restaurantId, req.params.id);
  res.json({ session });
});

export const regeneratePin = asyncHandler(async (req, res) => {
  const result = await regenerateSessionPin(req.admin!.restaurantId, req.params.id);
  res.json(result);
});

export const flagSession = asyncHandler(async (req, res) => {
  const session = await flagSessionAbusive(req.admin!.restaurantId, req.params.id);
  res.json({ session });
});

export const getPublicTable = asyncHandler(async (req, res) => {
  const table = await getPublicTableByQrToken(req.params.qrToken);
  res.json({ table });
});

export const joinSession = asyncHandler(async (req, res) => {
  const result = await joinTableSession(req.body.qrToken, req.body.pin);
  res.json(result);
});

export const guestSessionMe = asyncHandler(async (req, res) => {
  const guest = req.guestSession!;
  res.json({
    sessionId: guest.sessionId,
    restaurantId: guest.restaurantId,
    tableNumber: guest.tableNumber,
    expiresAt: guest.expiresAt.toISOString(),
  });
});
