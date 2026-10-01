import { Router } from 'express';
import { createOrder, listMyOrders } from '../controllers/ordersController';
import { authenticateGuest } from '../middleware/authenticateGuest';
import { orderLimiter } from '../middleware/rateLimit';
import { requireIdempotencyKey } from '../middleware/requireIdempotencyKey';
import { skipOrderRateLimitForReplay } from '../middleware/skipOrderRateLimitForReplay';
import { validate } from '../middleware/validate';
import { createOrderBodySchema } from '../validators/orders';

export const ordersRouter = Router();

ordersRouter.use(authenticateGuest);

ordersRouter.get('/mine', listMyOrders);
ordersRouter.post(
  '/',
  requireIdempotencyKey,
  skipOrderRateLimitForReplay,
  orderLimiter,
  validate(createOrderBodySchema),
  createOrder,
);
