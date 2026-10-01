import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from './app';
import { prisma } from './lib/db';

const OWNER_EMAIL = 'owner@demo.local';
const OWNER_PASSWORD = 'Owner@12345';

async function loginOwner() {
  const response = await request(app).post('/api/admin/auth/login').send({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
  });
  return response.body.accessToken as string;
}

async function guestContextForTable(tableNumber: string) {
  const table = await prisma.table.findFirst({
    where: { tableNumber },
    include: { restaurant: true },
  });
  if (!table) {
    throw new Error(`Table ${tableNumber} not found`);
  }

  await prisma.tableSession.deleteMany({ where: { tableId: table.id } });

  const ownerToken = await loginOwner();
  const opened = await request(app)
    .post(`/api/admin/tables/${table.id}/sessions`)
    .set('Authorization', `Bearer ${ownerToken}`);
  const pin = opened.body.pin as string;

  const joined = await request(app).post('/api/public/sessions/join').send({
    qrToken: table.qrToken,
    pin,
  });

  return {
    guestToken: joined.body.accessToken as string,
    tableId: table.id,
    restaurantId: table.restaurantId,
    sessionId: opened.body.session.id as string,
    ownerToken,
  };
}

describe('Phase 4 guest orders', () => {
  let guestToken: string;
  let sessionId: string;
  let menuItemId: string;
  let ownerToken: string;
  let tableId: string;

  beforeAll(async () => {
    const ctx = await guestContextForTable('2');
    guestToken = ctx.guestToken;
    sessionId = ctx.sessionId;
    ownerToken = ctx.ownerToken;
    tableId = ctx.tableId;

    const item = await prisma.menuItem.findFirst({
      where: { restaurantId: ctx.restaurantId, isAvailable: true },
      select: { id: true, price: true },
    });
    expect(item).not.toBeNull();
    menuItemId = item!.id;
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { tableSessionId: sessionId } });
    await prisma.tableSession.deleteMany({ where: { tableId } });
  });

  it('requires Idempotency-Key to place an order', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({ items: [{ menuItemId, quantity: 1 }] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('places an order using server-side prices', async () => {
    const menuItem = await prisma.menuItem.findUnique({ where: { id: menuItemId } });
    expect(menuItem).not.toBeNull();

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${guestToken}`)
      .set('Idempotency-Key', 'phase4-order-001')
      .send({
        notes: 'Less spicy',
        items: [{ menuItemId, quantity: 2 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.order.status).toBe('placed');
    expect(response.body.order.total).toBe(menuItem!.price * 2);
    expect(response.body.order.items[0].unitPrice).toBe(menuItem!.price);
  });

  it('ignores client-supplied prices (not accepted in schema) and recomputes from the database', async () => {
    const menuItem = await prisma.menuItem.update({
      where: { id: menuItemId },
      data: { price: 99999 },
      select: { price: true },
    });

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${guestToken}`)
      .set('Idempotency-Key', 'phase4-order-002')
      .send({
        items: [{ menuItemId, quantity: 1, price: 1 } as { menuItemId: string; quantity: number; price: number }],
      });

    expect(response.status).toBe(201);
    expect(response.body.order.total).toBe(menuItem.price);
  });

  it('returns the same order for duplicate Idempotency-Key', async () => {
    const first = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${guestToken}`)
      .set('Idempotency-Key', 'phase4-dup-key')
      .send({ items: [{ menuItemId, quantity: 1 }] });

    const second = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${guestToken}`)
      .set('Idempotency-Key', 'phase4-dup-key')
      .send({ items: [{ menuItemId, quantity: 5 }] });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.order.id).toBe(first.body.order.id);
    expect(second.body.order.items[0].quantity).toBe(1);
  });

  it('lists session orders via GET /api/orders/mine', async () => {
    const response = await request(app)
      .get('/api/orders/mine')
      .set('Authorization', `Bearer ${guestToken}`);
    expect(response.status).toBe(200);
    expect(response.body.orders.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects orders when the session is closed', async () => {
    const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
    expect(session).not.toBeNull();

    await request(app)
      .post(`/api/admin/sessions/${sessionId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${guestToken}`)
      .set('Idempotency-Key', 'phase4-after-close')
      .send({ items: [{ menuItemId, quantity: 1 }] });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('SESSION_CLOSED');
  });

  it('rejects unavailable menu items', async () => {
    const ctx = await guestContextForTable('3');
    const unavailable = await prisma.menuItem.findFirst({
      where: { name: 'Seasonal Mango Lassi' },
      select: { id: true },
    });
    expect(unavailable).not.toBeNull();

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${ctx.guestToken}`)
      .set('Idempotency-Key', 'phase4-unavailable')
      .send({ items: [{ menuItemId: unavailable!.id, quantity: 1 }] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('ITEM_UNAVAILABLE');

    await prisma.order.deleteMany({ where: { tableSessionId: ctx.sessionId } });
    await prisma.tableSession.deleteMany({ where: { tableId: ctx.tableId } });
  });

  it('creates pending_confirmation orders for auto-opened sessions', async () => {
    const table = await prisma.table.findFirst({
      where: { tableNumber: '4' },
      include: { restaurant: true },
    });
    expect(table).not.toBeNull();

    await prisma.restaurant.update({
      where: { id: table!.restaurantId },
      data: { requireStaffOpen: false },
    });
    await prisma.tableSession.deleteMany({ where: { tableId: table!.id } });

    const joined = await request(app).post('/api/public/sessions/join').send({
      qrToken: table!.qrToken,
    });
    expect(joined.status).toBe(200);

    const item = await prisma.menuItem.findFirst({
      where: { restaurantId: table!.restaurantId, isAvailable: true },
      select: { id: true },
    });

    const order = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${joined.body.accessToken}`)
      .set('Idempotency-Key', 'phase4-auto-session')
      .send({ items: [{ menuItemId: item!.id, quantity: 1 }] });

    expect(order.status).toBe(201);
    expect(order.body.order.status).toBe('pending_confirmation');

    const session = await prisma.tableSession.findFirst({
      where: { tableId: table!.id, status: 'open' },
      select: { id: true },
    });
    await prisma.order.deleteMany({ where: { tableSessionId: session!.id } });
    await prisma.tableSession.deleteMany({ where: { tableId: table!.id } });
    await prisma.restaurant.update({
      where: { id: table!.restaurantId },
      data: { requireStaffOpen: true },
    });
  });
});
