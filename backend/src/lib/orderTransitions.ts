import type { AdminRole, OrderStatus } from '@prisma/client';
import { HttpError } from './errors';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ['placed', 'cancelled'],
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['served', 'cancelled'],
  served: ['paid', 'cancelled'],
  paid: [],
  cancelled: [],
};

const ROLES_UPDATE_ORDERS: AdminRole[] = ['owner', 'manager', 'waiter', 'kitchen'];

export const ROLES_CONFIRM_ORDERS: AdminRole[] = ['owner', 'manager', 'waiter'];

export function assertCanUpdateOrders(role: AdminRole): void {
  if (!ROLES_UPDATE_ORDERS.includes(role)) {
    throw new HttpError(403, 'FORBIDDEN', 'You cannot update orders');
  }
}

export function assertCanConfirmOrders(role: AdminRole): void {
  if (!ROLES_CONFIRM_ORDERS.includes(role)) {
    throw new HttpError(403, 'FORBIDDEN', 'Kitchen staff cannot confirm orders');
  }
}

export function assertValidTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new HttpError(400, 'INVALID_TRANSITION', `Cannot change order from ${from} to ${to}`);
  }
}

export function assertRoleCanTransition(role: AdminRole, from: OrderStatus, to: OrderStatus): void {
  if (['owner', 'manager'].includes(role)) {
    return;
  }

  if (to === 'paid') {
    throw new HttpError(403, 'FORBIDDEN', 'Only owner or manager can mark an order as paid');
  }

  if (to === 'cancelled') {
    if (role === 'kitchen') {
      throw new HttpError(403, 'FORBIDDEN', 'Kitchen staff cannot cancel orders');
    }
    return;
  }

  if (role === 'kitchen') {
    const kitchenForward =
      (from === 'placed' && to === 'accepted') ||
      (from === 'accepted' && to === 'preparing') ||
      (from === 'preparing' && to === 'served');
    if (!kitchenForward) {
      throw new HttpError(403, 'FORBIDDEN', 'Kitchen staff can only move orders along the kitchen line');
    }
    return;
  }

  if (from === 'pending_confirmation' && to === 'placed') {
    return;
  }

  const waiterForward =
    (from === 'placed' && to === 'accepted') ||
    (from === 'accepted' && to === 'preparing') ||
    (from === 'preparing' && to === 'served');
  if (waiterForward) {
    return;
  }

  throw new HttpError(403, 'FORBIDDEN', 'You cannot perform this status change');
}

export function listNextStatusesForRole(role: AdminRole, from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from].filter((to) => {
    try {
      assertRoleCanTransition(role, from, to);
      return true;
    } catch {
      return false;
    }
  });
}
