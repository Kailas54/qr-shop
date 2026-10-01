import { z } from 'zod';

export const createTableBodySchema = z.object({
  tableNumber: z.string().trim().min(1).max(32),
  isActive: z.boolean().optional().default(true),
});

export const updateTableBodySchema = z.object({
  tableNumber: z.string().trim().min(1).max(32).optional(),
  isActive: z.boolean().optional(),
});

export const tableQrQuerySchema = z.object({
  format: z.enum(['png', 'svg']).default('png'),
});
