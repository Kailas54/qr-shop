import { z } from 'zod';

export const orderLineSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  customizations: z.record(z.unknown()).optional().default({}),
});

export const createOrderBodySchema = z.object({
  notes: z.string().max(500).optional().default(''),
  items: z.array(orderLineSchema).min(1),
});

export const idempotencyKeyHeaderSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._-]+$/);
