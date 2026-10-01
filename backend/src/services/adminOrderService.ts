import type { OrderStatus } from '@prisma/client';
import { env } from '../config/env';
import {
  assertCanConfirmOrders,
  assertCanUpdateOrders,
  assertRoleCanTransition,
  assertValidTransition,
  listNextStatusesForRole,
} from '../lib/orderTransitions';
import { HttpError } from '../lib/errors';
import { notifyGuestOrderStatus, notifyOrderUpdated } from '../lib/pusher';
import { prisma } from '../lib/db';

const BOARD_STATUSES: OrderStatus[] = [
  'pending_confirmation',
  'placed',
  'accepted',
  'preparing',
  'served',
];

function mapAdminOrder(order: {
  id: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
  tableSessionId: string;
  table: { tableNumber: string };
  items: Array<{
    nameSnapshot: string;
    priceSnapshot: number;
    quantity: number;
  }>;
}) {
  return {
    id: order.id,
    status: order.status,
    tableNumber: order.table.tableNumber,
    sessionId: order.tableSessionId,
    subtotal: order.subtotal,
    total: order.total,
    notes: order.notes,
    flaggedForReview: order.total >= env.ORDER_VALUE_REVIEW_THRESHOLD,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      name: item.nameSnapshot,
      quantity: item.quantity,
      unitPrice: item.priceSnapshot,
    })),
  };
}

export async function listAdminOrders(
  restaurantId: string,
  filters: {
    status?: OrderStatus;
    tableNumber?: string;
    from?: Date;
    to?: Date;
    boardOnly?: boolean;
    limit: number;
    offset: number;
  },
) {
  const where = {
    restaurantId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.boardOnly ? { status: { in: BOARD_STATUSES } } : {}),
    ...(filters.tableNumber
      ? { table: { tableNumber: filters.tableNumber } }
      : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
      include: {
        table: { select: { tableNumber: true } },
        items: {
          select: { nameSnapshot: true, priceSnapshot: true, quantity: true },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map(mapAdminOrder),
    pagination: { total, limit: filters.limit, offset: filters.offset },
  };
}

export async function updateAdminOrderStatus(
  restaurantId: string,
  orderId: string,
  toStatus: OrderStatus,
  changedByAdminId: string,
  adminRole: Parameters<typeof assertCanUpdateOrders>[0],
) {
  assertCanUpdateOrders(adminRole);

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      table: { select: { tableNumber: true } },
      items: { select: { nameSnapshot: true, priceSnapshot: true, quantity: true } },
    },
  });
  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  }

  assertValidTransition(order.status, toStatus);
  assertRoleCanTransition(adminRole, order.status, toStatus);

  const updated = await prisma.$transaction(
    async (tx) => {
    const saved = await tx.order.update({
      where: { id: orderId },
      data: { status: toStatus },
      include: {
        table: { select: { tableNumber: true } },
        items: { select: { nameSnapshot: true, priceSnapshot: true, quantity: true } },
      },
    });
    await tx.orderEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus,
        changedBy: changedByAdminId,
      },
    });
    return saved;
    },
    { maxWait: 15_000, timeout: 30_000 },
  );

  const updatedAt = updated.updatedAt.toISOString();
  notifyOrderUpdated(restaurantId, {
    orderId: updated.id,
    tableNumber: updated.table.tableNumber,
    sessionId: updated.tableSessionId,
    fromStatus: order.status,
    toStatus,
    updatedAt,
  });
  notifyGuestOrderStatus(updated.tableSessionId, {
    orderId: updated.id,
    status: toStatus,
    updatedAt,
  });

  return mapAdminOrder(updated);
}

export async function confirmAdminOrder(
  restaurantId: string,
  orderId: string,
  changedByAdminId: string,
  adminRole: Parameters<typeof assertCanUpdateOrders>[0],
) {
  assertCanConfirmOrders(adminRole);

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    select: { status: true },
  });
  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  }
  if (order.status !== 'pending_confirmation') {
    throw new HttpError(409, 'INVALID_STATE', 'Only pending orders can be confirmed');
  }

  return updateAdminOrderStatus(restaurantId, orderId, 'placed', changedByAdminId, adminRole);
}

export async function getAdminOrderDetail(
  restaurantId: string,
  orderId: string,
  adminRole: Parameters<typeof assertCanUpdateOrders>[0],
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      table: { select: { tableNumber: true } },
      items: { select: { nameSnapshot: true, priceSnapshot: true, quantity: true } },
      events: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) {
    throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  }

  const adminIds = order.events.map((event) => event.changedBy).filter((id): id is string => Boolean(id));
  const admins =
    adminIds.length > 0
      ? await prisma.admin.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true, role: true },
        })
      : [];
  const adminById = new Map(admins.map((admin) => [admin.id, admin]));

  return {
    order: mapAdminOrder(order),
    allowedNextStatuses: listNextStatusesForRole(adminRole, order.status),
    events: order.events.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      createdAt: event.createdAt.toISOString(),
      changedBy: event.changedBy
        ? {
            id: event.changedBy,
            name: adminById.get(event.changedBy)?.name ?? 'Staff',
            role: adminById.get(event.changedBy)?.role ?? null,
          }
        : null,
    })),
  };
}
