import { z } from 'zod';

export const pusherAuthBodySchema = z.object({
  socket_id: z.string().min(6).max(256),
  channel_name: z.string().min(3).max(256),
});
