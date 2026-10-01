import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.string().email().max(320).transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(20).max(4096),
});
