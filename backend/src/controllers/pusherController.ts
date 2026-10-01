import { asyncHandler } from '../lib/asyncHandler';
import { HttpError } from '../lib/errors';
import { authorizePusherSubscription } from '../services/pusherAuthService';

export const auth = asyncHandler(async (req, res) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();

  const authResponse = await authorizePusherSubscription({
    socketId: req.body.socket_id,
    channelName: req.body.channel_name,
    bearerToken: token,
  });

  res.send(authResponse);
});
