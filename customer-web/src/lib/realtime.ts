import Pusher from 'pusher-js';
import { apiRequest, getApiUrl } from './api';

export type RealtimeConfig = {
  enabled: boolean;
  key: string | null;
  cluster: string;
};

export async function fetchRealtimeConfig() {
  return apiRequest<RealtimeConfig>('/api/public/realtime-config');
}

export function connectSessionPusher(
  guestToken: string,
  sessionId: string,
  config: RealtimeConfig,
  onStatusChanged: (payload: { orderId: string; status: string; updatedAt: string }) => void,
): Pusher | null {
  if (!config.enabled || !config.key) {
    return null;
  }

  const pusher = new Pusher(config.key, {
    cluster: config.cluster,
    forceTLS: true,
    channelAuthorization: {
      transport: 'ajax',
      endpoint: `${getApiUrl()}/api/pusher/auth`,
      headersProvider: () => ({ Authorization: `Bearer ${guestToken}` }),
    },
  });

  const channel = pusher.subscribe(`private-session-${sessionId}`);
  channel.bind('order.status_changed', onStatusChanged);
  return pusher;
}
