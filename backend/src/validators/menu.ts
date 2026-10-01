import { z } from 'zod';

export const createCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
});

export const updateCategoryBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const createMenuItemBodySchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional().default(''),
  price: z.number().int().nonnegative().max(10_000_000),
  isAvailable: z.boolean().optional().default(true),
  isVeg: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(10_000).optional().default(0),
  imageUrl: z.string().url().max(2048).nullable().optional(),
});

export const updateMenuItemBodySchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(2000).optional(),
  price: z.number().int().nonnegative().max(10_000_000).optional(),
  isAvailable: z.boolean().optional(),
  isVeg: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
});

export const toggleAvailabilityBodySchema = z.object({
  isAvailable: z.boolean(),
});
