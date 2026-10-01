import { z } from 'zod';

const orderStatusEnum = z.enum([
  'pending_confirmation',
  'placed',
  'accepted',
  'preparing',
  'served',
  'paid',
  'cancelled',
]);

export const listAdminOrdersQuerySchema = z.object({
  status: orderStatusEnum.optional(),
  table: z.string().trim().min(1).max(32).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  board: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const updateOrderStatusBodySchema = z.object({
  status: orderStatusEnum,
});
