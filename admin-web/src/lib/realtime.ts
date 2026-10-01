import Pusher from 'pusher-js';
import { getAuthBridge } from '../auth/sessionBridge';
import { apiRequestAuthed, getApiUrl } from './api';

export type RealtimeConfig = {
  enabled: boolean;
  key: string | null;
  cluster: string;
};

export type BoardOrder = {
  id: string;
  status: string;
  tableNumber: string;
  sessionId: string;
  total: number;
  notes: string;
  flaggedForReview: boolean;
  createdAt: string;
  updatedAt: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
};

export async function fetchRealtimeConfig(): Promise<RealtimeConfig> {
  return apiRequestAuthed<RealtimeConfig>('/api/admin/realtime-config');
}

export function connectRestaurantPusher(
  restaurantId: string,
  config: RealtimeConfig,
  handlers: {
    onOrderCreated: (payload: unknown) => void;
    onOrderUpdated: (payload: unknown) => void;
  },
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
      headersProvider: () => {
        const token = getAuthBridge()?.getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    },
  });

  const channel = pusher.subscribe(`private-restaurant-${restaurantId}`);
  channel.bind('order.created', handlers.onOrderCreated);
  channel.bind('order.updated', handlers.onOrderUpdated);

  return pusher;
}

export async function fetchBoardOrders() {
  return apiRequestAuthed<{ orders: BoardOrder[] }>('/api/admin/orders?board=true');
}

export async function patchOrderStatus(orderId: string, status: string) {
  return apiRequestAuthed<{ order: BoardOrder }>(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function confirmOrder(orderId: string) {
  return apiRequestAuthed<{ order: BoardOrder }>(`/api/admin/orders/${orderId}/confirm`, {
    method: 'POST',
  });
}

export type OrderAuditEvent = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
  changedBy: { id: string; name: string; role: string | null } | null;
};

export async function fetchOrderDetail(orderId: string) {
  return apiRequestAuthed<{
    order: BoardOrder;
    allowedNextStatuses: string[];
    events: OrderAuditEvent[];
  }>(`/api/admin/orders/${orderId}`);
}
