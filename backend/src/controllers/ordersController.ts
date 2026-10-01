import { asyncHandler } from '../lib/asyncHandler';
import { HttpError } from '../lib/errors';
import { listGuestSessionOrders, placeGuestOrder } from '../services/orderService';

export const createOrder = asyncHandler(async (req, res) => {
  if (!req.guestSession || !req.idempotencyKey) {
    throw new HttpError(500, 'INTERNAL', 'Order context missing');
  }

  const result = await placeGuestOrder(
    req.guestSession,
    req.idempotencyKey,
    req.body.notes,
    req.body.items,
  );

  res.status(result.created ? 201 : 200).json({ order: result.order });
});

export const listMyOrders = asyncHandler(async (req, res) => {
  if (!req.guestSession) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Guest session required');
  }
  const orders = await listGuestSessionOrders(req.guestSession.sessionId);
  res.json({ orders });
});
