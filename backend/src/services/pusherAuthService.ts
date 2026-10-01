import { verifyGuestSessionToken } from '../lib/guestAuth';
import { verifyStaffToken } from '../lib/auth';
import { HttpError } from '../lib/errors';
import { authorizePusherChannel, isPusherConfigured } from '../lib/pusher';
import { parseRestaurantChannel, parseSessionChannel } from '../lib/pusherChannels';
import { loadGuestSessionContext } from './sessionService';

export async function authorizePusherSubscription(input: {
  socketId: string;
  channelName: string;
  bearerToken: string;
}): Promise<{ auth: string }> {
  if (!isPusherConfigured()) {
    throw new HttpError(503, 'PUSHER_UNAVAILABLE', 'Realtime is not configured');
  }

  const restaurantId = parseRestaurantChannel(input.channelName);
  if (restaurantId) {
    const staff = verifyStaffToken(input.bearerToken, 'access');
    if (staff.restaurantId !== restaurantId) {
      throw new HttpError(403, 'FORBIDDEN', 'Cannot subscribe to this restaurant channel');
    }
    const auth = authorizePusherChannel(input.socketId, input.channelName);
    if (!auth) {
      throw new HttpError(503, 'PUSHER_UNAVAILABLE', 'Realtime is not configured');
    }
    return auth;
  }

  const sessionId = parseSessionChannel(input.channelName);
  if (sessionId) {
    const guest = verifyGuestSessionToken(input.bearerToken);
    if (guest.sessionId !== sessionId) {
      throw new HttpError(403, 'FORBIDDEN', 'Cannot subscribe to this session channel');
    }
    return await authorizeGuestChannel(input.socketId, input.channelName, sessionId);
  }

  throw new HttpError(403, 'FORBIDDEN', 'Unknown or unsupported channel');
}

async function authorizeGuestChannel(socketId: string, channelName: string, sessionId: string) {
  await loadGuestSessionContext(sessionId);
  const auth = authorizePusherChannel(socketId, channelName);
  if (!auth) {
    throw new HttpError(503, 'PUSHER_UNAVAILABLE', 'Realtime is not configured');
  }
  return auth;
}
