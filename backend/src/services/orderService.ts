import { Prisma } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';
import { env } from '../config/env';
import { HttpError } from '../lib/errors';
import { notifyOrderCreated } from '../lib/pusher';
import { prisma } from '../lib/db';
import { isSessionActive } from './sessionService';

type GuestContext = {
  sessionId: string;
  tableId: string;
  restaurantId: string;
  tableNumber: string;
};

type OrderLineInput = {
  menuItemId: string;
  quantity: number;
  customizations: Record<string, unknown>;
};

function mergeLines(items: OrderLineInput[]): OrderLineInput[] {
  const map = new Map<string, OrderLineInput>();
  for (const line of items) {
    const existing = map.get(line.menuItemId);
    if (existing) {
      existing.quantity += line.quantity;
      existing.customizations = { ...existing.customizations, ...line.customizations };
    } else {
      map.set(line.menuItemId, { ...line });
    }
  }
  return [...map.values()];
}

function mapOrderResponse(
  order: {
    id: string;
    status: OrderStatus;
    subtotal: number;
    total: number;
    notes: string;
    createdAt: Date;
    items: Array<{
      menuItemId: string;
      nameSnapshot: string;
      priceSnapshot: number;
      quantity: number;
      customizations: unknown;
    }>;
  },
  flaggedForReview: boolean,
) {
  return {
    id: order.id,
    status: order.status,
    subtotal: order.subtotal,
    total: order.total,
    notes: order.notes,
    flaggedForReview,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      menuItemId: item.menuItemId,
      name: item.nameSnapshot,
      unitPrice: item.priceSnapshot,
      quantity: item.quantity,
      lineTotal: item.priceSnapshot * item.quantity,
      customizations: item.customizations,
    })),
  };
}

export async function findOrderByIdempotency(sessionId: string, idempotencyKey: string) {
  const order = await prisma.order.findUnique({
    where: { tableSessionId_idempotencyKey: { tableSessionId: sessionId, idempotencyKey } },
    include: {
      items: {
        select: {
          menuItemId: true,
          nameSnapshot: true,
          priceSnapshot: true,
          quantity: true,
          customizations: true,
        },
      },
    },
  });
  if (!order) {
    return null;
  }
  const flaggedForReview = order.total >= env.ORDER_VALUE_REVIEW_THRESHOLD;
  return mapOrderResponse(order, flaggedForReview);
}

export async function placeGuestOrder(
  guest: GuestContext,
  idempotencyKey: string,
  notes: string,
  rawItems: OrderLineInput[],
) {
  const existing = await findOrderByIdempotency(guest.sessionId, idempotencyKey);
  if (existing) {
    return { order: existing, created: false };
  }

  const items = mergeLines(rawItems);
  if (items.length > env.MAX_ITEMS_PER_ORDER) {
    throw new HttpError(400, 'TOO_MANY_ITEMS', `Maximum ${env.MAX_ITEMS_PER_ORDER} different items per order`);
  }
  for (const line of items) {
    if (line.quantity > env.MAX_QTY_PER_ITEM) {
      throw new HttpError(400, 'QTY_TOO_HIGH', `Maximum ${env.MAX_QTY_PER_ITEM} per item`);
    }
  }

  const menuItemIds = items.map((line) => line.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds }, restaurantId: guest.restaurantId },
    select: { id: true, name: true, price: true, isAvailable: true },
  });

  if (menuItems.length !== menuItemIds.length) {
    throw new HttpError(400, 'INVALID_MENU_ITEM', 'One or more menu items are invalid for this restaurant');
  }

  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  for (const line of items) {
    const menuItem = menuById.get(line.menuItemId)!;
    if (!menuItem.isAvailable) {
      throw new HttpError(400, 'ITEM_UNAVAILABLE', `${menuItem.name} is not available`);
    }
  }

  let subtotal = 0;
  const pricedLines = items.map((line) => {
    const menuItem = menuById.get(line.menuItemId)!;
    subtotal += menuItem.price * line.quantity;
    return {
      menuItemId: menuItem.id,
      nameSnapshot: menuItem.name,
      priceSnapshot: menuItem.price,
      quantity: line.quantity,
      customizations: line.customizations as Prisma.InputJsonValue,
    };
  });

  const total = subtotal;
  const flaggedForReview = total >= env.ORDER_VALUE_REVIEW_THRESHOLD;

  let result: {
    order: {
      id: string;
      status: OrderStatus;
      subtotal: number;
      total: number;
      notes: string;
      createdAt: Date;
      items: Array<{
        menuItemId: string;
        nameSnapshot: string;
        priceSnapshot: number;
        quantity: number;
        customizations: unknown;
      }>;
    };
    initialStatus: OrderStatus;
  };

  try {
    result = await prisma.$transaction(
      async (tx) => {
    const session = await tx.tableSession.findUnique({
      where: { id: guest.sessionId },
      select: { id: true, status: true, expiresAt: true, openedBy: true, tableId: true },
    });
    if (!session || session.tableId !== guest.tableId || !isSessionActive(session)) {
      throw new HttpError(401, 'SESSION_CLOSED', 'Table session has ended');
    }

    const initialStatus: OrderStatus = session.openedBy ? 'placed' : 'pending_confirmation';

    const order = await tx.order.create({
      data: {
        restaurantId: guest.restaurantId,
        tableId: guest.tableId,
        tableSessionId: guest.sessionId,
        status: initialStatus,
        subtotal,
        total,
        notes,
        idempotencyKey,
        items: { create: pricedLines },
        events: {
          create: {
            fromStatus: null,
            toStatus: initialStatus,
            changedBy: null,
          },
        },
      },
      include: {
        items: {
          select: {
            menuItemId: true,
            nameSnapshot: true,
            priceSnapshot: true,
            quantity: true,
            customizations: true,
          },
        },
      },
    });

      return { order, initialStatus };
      },
      { maxWait: 15_000, timeout: 120_000 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await findOrderByIdempotency(guest.sessionId, idempotencyKey);
      if (duplicate) {
        return { order: duplicate, created: false };
      }
    }
    throw error;
  }

  notifyOrderCreated(guest.restaurantId, {
    orderId: result.order.id,
    tableNumber: guest.tableNumber,
    sessionId: guest.sessionId,
    status: result.initialStatus,
    items: result.order.items.map((item) => ({
      name: item.nameSnapshot,
      quantity: item.quantity,
      price: item.priceSnapshot,
    })),
    total: result.order.total,
    notes: result.order.notes,
    flaggedForReview,
    createdAt: result.order.createdAt.toISOString(),
  });

  return { order: mapOrderResponse(result.order, flaggedForReview), created: true };
}

export async function listGuestSessionOrders(sessionId: string) {
  const orders = await prisma.order.findMany({
    where: { tableSessionId: sessionId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: {
        select: {
          menuItemId: true,
          nameSnapshot: true,
          priceSnapshot: true,
          quantity: true,
          customizations: true,
        },
      },
    },
  });

  return orders.map((order) => mapOrderResponse(order, order.total >= env.ORDER_VALUE_REVIEW_THRESHOLD));
}
