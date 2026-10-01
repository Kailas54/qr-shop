import Pusher from 'pusher';
import { env } from '../config/env';
import { logger } from './logger';

let client: Pusher | null | undefined;

export function getPusherClient(): Pusher | null {
  if (client !== undefined) {
    return client;
  }
  if (!env.PUSHER_APP_ID || !env.PUSHER_KEY || !env.PUSHER_SECRET) {
    client = null;
    return client;
  }
  client = new Pusher({
    appId: env.PUSHER_APP_ID,
    key: env.PUSHER_KEY,
    secret: env.PUSHER_SECRET,
    cluster: env.PUSHER_CLUSTER,
    useTLS: true,
  });
  return client;
}

export function isPusherConfigured(): boolean {
  return getPusherClient() !== null;
}

export function authorizePusherChannel(socketId: string, channelName: string): { auth: string } | null {
  const pusher = getPusherClient();
  if (!pusher) {
    return null;
  }
  return pusher.authorizeChannel(socketId, channelName);
}

function trigger(channel: string, event: string, payload: unknown): void {
  const pusher = getPusherClient();
  if (!pusher) {
    return;
  }
  void pusher.trigger(channel, event, payload).catch((error: unknown) => {
    logger.warn({ err: error, channel, event }, 'pusher trigger failed');
  });
}

export type OrderCreatedEvent = {
  orderId: string;
  tableNumber: string;
  sessionId: string;
  status: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  notes: string;
  flaggedForReview: boolean;
  createdAt: string;
};

export type OrderUpdatedEvent = {
  orderId: string;
  tableNumber: string;
  sessionId: string;
  fromStatus: string | null;
  toStatus: string;
  updatedAt: string;
};

export type SessionOpenedEvent = {
  sessionId: string;
  tableId: string;
  tableNumber: string;
  openedAt: string;
  expiresAt: string;
};

export type SessionClosedEvent = {
  sessionId: string;
  tableId: string;
  tableNumber: string;
  closedAt: string;
};

export type GuestOrderStatusEvent = {
  orderId: string;
  status: string;
  updatedAt: string;
};

export function notifyOrderCreated(restaurantId: string, payload: OrderCreatedEvent): void {
  trigger(`private-restaurant-${restaurantId}`, 'order.created', payload);
}

export function notifyOrderUpdated(restaurantId: string, payload: OrderUpdatedEvent): void {
  trigger(`private-restaurant-${restaurantId}`, 'order.updated', payload);
}

export function notifySessionOpened(restaurantId: string, payload: SessionOpenedEvent): void {
  trigger(`private-restaurant-${restaurantId}`, 'session.opened', payload);
}

export function notifySessionClosed(restaurantId: string, payload: SessionClosedEvent): void {
  trigger(`private-restaurant-${restaurantId}`, 'session.closed', payload);
}

export function notifyGuestOrderStatus(sessionId: string, payload: GuestOrderStatusEvent): void {
  trigger(`private-session-${sessionId}`, 'order.status_changed', payload);
}
