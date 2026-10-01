import bcrypt from 'bcrypt';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { app } from './app';
import { env } from './config/env';
import { prisma } from './lib/db';

const OWNER_EMAIL = 'owner@demo.local';
const OWNER_PASSWORD = 'Owner@12345';

describe('Phase 7 order lifecycle', () => {
  let ownerToken: string;
  let kitchenToken: string;
  let restaurantId: string;
  let orderId: string;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.findFirst({ where: { name: 'Demo Restaurant' } });
    expect(restaurant).not.toBeNull();
    restaurantId = restaurant!.id;

    const kitchenHash = await bcrypt.hash('Kitchen@12345', env.BCRYPT_COST);
    await prisma.admin.upsert({
      where: { email: 'kitchen@demo.local' },
      create: {
        restaurantId,
        email: 'kitchen@demo.local',
        name: 'Kitchen Staff',
        passwordHash: kitchenHash,
        role: 'kitchen',
      },
      update: { passwordHash: kitchenHash, role: 'kitchen', restaurantId },
    });

    const ownerLogin = await request(app).post('/api/admin/auth/login').send({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    ownerToken = ownerLogin.body.accessToken;

    const kitchenLogin = await request(app).post('/api/admin/auth/login').send({
      email: 'kitchen@demo.local',
      password: 'Kitchen@12345',
    });
    kitchenToken = kitchenLogin.body.accessToken;

    const table = await prisma.table.findFirst({
      where: { restaurantId, tableNumber: '8' },
      select: { id: true },
    });
    const menuItemId = (
      await prisma.menuItem.findFirst({ where: { restaurantId }, select: { id: true } })
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

    const order = await prisma.order.create({
      data: {
        restaurantId,
        tableId: table!.id,
        tableSessionId: session.id,
        status: 'placed',
        subtotal: 5000,
        total: 5000,
        idempotencyKey: 'phase7-order',
        events: { create: { fromStatus: null, toStatus: 'placed' } },
        items: {
          create: {
            menuItemId,
            nameSnapshot: 'Test',
            priceSnapshot: 5000,
            quantity: 1,
          },
        },
      },
      select: { id: true },
    });
    orderId = order.id;
  });

  it('returns order detail with audit events', async () => {
    const response = await request(app)
      .get(`/api/admin/orders/${orderId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(response.status).toBe(200);
    expect(response.body.order.id).toBe(orderId);
    expect(response.body.events.length).toBeGreaterThan(0);
    expect(response.body.allowedNextStatuses).toContain('accepted');
  });

  it('blocks kitchen from cancelling orders', async () => {
    const response = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ status: 'cancelled' });
    expect(response.status).toBe(403);
  });

  it('allows kitchen to accept then owner to mark paid after served', async () => {
    await prisma.order.update({ where: { id: orderId }, data: { status: 'placed' } });

    const accepted = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ status: 'accepted' });
    expect(accepted.status).toBe(200);

    await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'preparing' });

    await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'served' });

    const paid = await request(app)
      .patch(`/api/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'paid' });
    expect(paid.status).toBe(200);
    expect(paid.body.order.status).toBe('paid');

    const events = await prisma.orderEvent.count({ where: { orderId } });
    expect(events).toBeGreaterThanOrEqual(4);
  });
});
