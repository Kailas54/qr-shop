import { apiRequest } from './api';

export type GuestOrder = {
  id: string;
  status: string;
  subtotal: number;
  total: number;
  notes: string;
  flaggedForReview: boolean;
  createdAt: string;
  items: Array<{
    menuItemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
};

export async function fetchMyOrders(token: string) {
  const result = await apiRequest<{ orders: GuestOrder[] }>('/api/orders/mine', { token });
  return result.orders;
}

export async function placeOrder(
  token: string,
  input: { notes: string; items: Array<{ menuItemId: string; quantity: number }> },
  idempotencyKey: string,
) {
  const result = await apiRequest<{ order: GuestOrder }>('/api/orders', {
    method: 'POST',
    token,
    idempotencyKey,
    body: JSON.stringify(input),
  });
  return result.order;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Waiting for staff',
  placed: 'Sent to kitchen',
  accepted: 'Accepted',
  preparing: 'Being prepared',
  served: 'Served',
  paid: 'Paid',
  cancelled: 'Cancelled',
};
