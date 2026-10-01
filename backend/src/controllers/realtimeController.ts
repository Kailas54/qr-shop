import { env } from '../config/env';
import { asyncHandler } from '../lib/asyncHandler';
import { isPusherConfigured } from '../lib/pusher';

function realtimeConfigPayload() {
  return {
    enabled: isPusherConfigured(),
    key: isPusherConfigured() ? env.PUSHER_KEY : null,
    cluster: env.PUSHER_CLUSTER,
  };
}

export const staffRealtimeConfig = asyncHandler(async (_req, res) => {
  res.json(realtimeConfigPayload());
});

export const publicRealtimeConfig = asyncHandler(async (_req, res) => {
  res.json(realtimeConfigPayload());
});
