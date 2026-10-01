import { z } from 'zod';

export const joinSessionBodySchema = z.object({
  qrToken: z.string().trim().min(16).max(256),
  pin: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

export const listSessionsQuerySchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
});
