import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from './app';
import { isPusherConfigured } from './lib/pusher';
import { prisma } from './lib/db';

const OWNER_EMAIL = 'owner@demo.local';
const OWNER_PASSWORD = 'Owner@12345';

describe('Phase 5 admin orders and pusher auth', () => {
  let ownerToken: string;
  let restaurantId: string;
  let orderId: string;

  beforeAll(async () => {
    const login = await request(app).post('/api/admin/auth/login').send({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    ownerToken = login.body.accessToken;
    restaurantId = login.body.admin.restaurantId;

    let order = await prisma.order.findFirst({
      where: { restaurantId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });

    if (!order) {
      const table = await prisma.table.findFirst({
        where: { restaurantId, tableNumber: '9' },
        select: { id: true },
      });
      const menuItemId = (
        await prisma.menuItem.findFirst({
          where: { restaurantId },
          select: { id: true },
        })
      )!.id;

      await prisma.order.deleteMany({ where: { tableId: table!.id } });
      await prisma.tableSession.deleteMany({ where: { tableId: table!.id } });

      const session = await prisma.tableSession.create({
        data: {
          tableId: table!.id,
          pinHash: 'test',
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
          status: 'open',
        },
      });
      order = await prisma.order.create({
        data: {
          restaurantId,
          tableId: table!.id,
          tableSessionId: session.id,
          status: 'placed',
          subtotal: 10000,
          total: 10000,
          idempotencyKey: 'phase5-seed-order',
          items: {
            create: {
              menuItemId,
              nameSnapshot: 'Test',
              priceSnapshot: 10000,
              quantity: 1,
            },
          },
        },
        select: { id: true, status: true },
      });
    }

    orderId = order.id;
    await prisma.order.update({ where: { id: orderId }, data: { status: 'placed' } });
  });

  it('returns realtime config for authenticated staff', async () => {
    const response = await request(app)
      .get('/api/admin/realtime-config')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.cluster).toBe('ap2');
    expect(response.body.enabled).toBe(isPusherConfigured());
  });

  it('lists board orders for the restaurant', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'placed' } });

    const response = await request(app)
      .get('/api/admin/orders?board=true')
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.orders.length).toBeGreaterThan(0);
    expect(response.body.orders[0].tableNumber).toEqual(expect.any(String));
  });

  it('updates order status and writes order_events', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'placed' } });

    const response = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'accepted' });

    expect(response.status).toBe(200);
    expect(response.body.order.status).toBe('accepted');

    const events = await prisma.orderEvent.count({ where: { orderId } });
    expect(events).toBeGreaterThan(0);
  });

  it('rejects pusher auth for the wrong restaurant channel', async () => {
    const response = await request(app)
      .post('/api/pusher/auth')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        socket_id: '1234.5678',
        channel_name: 'private-restaurant-00000000-0000-0000-0000-000000000000',
      });

    if (isPusherConfigured()) {
      expect(response.status).toBe(403);
    } else {
      expect(response.status).toBe(503);
    }
  });

  it('authorizes the correct restaurant channel when pusher is configured', async () => {
    const response = await request(app)
      .post('/api/pusher/auth')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        socket_id: '1234.5678',
        channel_name: `private-restaurant-${restaurantId}`,
      });

    if (isPusherConfigured()) {
      expect(response.status).toBe(200);
      expect(response.body.auth).toEqual(expect.any(String));
    } else {
      expect(response.status).toBe(503);
    }
  });
});
