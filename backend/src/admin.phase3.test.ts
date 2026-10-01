import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from './app';
import { env } from './config/env';
import { prisma } from './lib/db';

const OWNER_EMAIL = 'owner@demo.local';
const OWNER_PASSWORD = 'Owner@12345';

describe('Phase 3 table sessions', () => {
  let ownerToken: string;
  let kitchenToken: string;
  let restaurantId: string;
  let tableId: string;
  let qrToken: string;
  let sessionId: string;
  let tablePin: string;
  let guestToken: string;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.findFirst({ where: { name: 'Demo Restaurant' } });
    expect(restaurant).not.toBeNull();
    restaurantId = restaurant!.id;

    const table = await prisma.table.findFirst({
      where: { restaurantId, tableNumber: '1' },
      select: { id: true, qrToken: true },
    });
    expect(table).not.toBeNull();
    tableId = table!.id;
    qrToken = table!.qrToken;

    await prisma.order.deleteMany({ where: { tableId } });
    await prisma.tableSession.deleteMany({ where: { tableId } });

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
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { tableId } });
    await prisma.tableSession.deleteMany({ where: { tableId } });
    await prisma.admin.deleteMany({ where: { email: 'kitchen@demo.local' } });
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { requireStaffOpen: true },
    });
  });

  it('public table payload hides internal ids but includes menu', async () => {
    const response = await request(app).get(`/api/public/tables/${qrToken}`);
    expect(response.status).toBe(200);
    expect(response.body.table.sessionOpen).toBe(false);
    expect(response.body.table.restaurantName).toBe('Demo Restaurant');
    expect(response.body.table.tableNumber).toBe('1');
    expect(response.body.table).not.toHaveProperty('id');
    expect(response.body.table).not.toHaveProperty('restaurantId');
    expect(response.body.table.menu.categories.length).toBeGreaterThan(0);
  });

  it('rejects join when staff have not opened the table', async () => {
    const response = await request(app).post('/api/public/sessions/join').send({
      qrToken,
      pin: '1234',
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TABLE_NOT_OPEN');
  });

  it('forbids kitchen from opening a table session', async () => {
    const response = await request(app)
      .post(`/api/admin/tables/${tableId}/sessions`)
      .set('Authorization', `Bearer ${kitchenToken}`);
    expect(response.status).toBe(403);
  });

  it('opens a table, exposes PIN once, and allows guest join', async () => {
    const opened = await request(app)
      .post(`/api/admin/tables/${tableId}/sessions`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(opened.status).toBe(201);
    expect(opened.body.pin).toMatch(/^\d{4}$/);
    sessionId = opened.body.session.id;
    tablePin = opened.body.pin;

    const publicView = await request(app).get(`/api/public/tables/${qrToken}`);
    expect(publicView.body.table.sessionOpen).toBe(true);

    const joined = await request(app).post('/api/public/sessions/join').send({
      qrToken,
      pin: tablePin,
    });
    expect(joined.status).toBe(200);
    expect(joined.body.accessToken).toEqual(expect.any(String));
    guestToken = joined.body.accessToken;

    const me = await request(app)
      .get('/api/public/sessions/me')
      .set('Authorization', `Bearer ${guestToken}`);
    expect(me.status).toBe(200);
    expect(me.body.tableNumber).toBe('1');
  });

  it('rejects wrong PIN', async () => {
    const response = await request(app).post('/api/public/sessions/join').send({
      qrToken,
      pin: '0000',
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_PIN');
  });

  it('rejects guest token after staff close the session', async () => {
    const closed = await request(app)
      .post(`/api/admin/sessions/${sessionId}/close`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(closed.status).toBe(200);
    expect(closed.body.session.status).toBe('closed');

    const me = await request(app)
      .get('/api/public/sessions/me')
      .set('Authorization', `Bearer ${guestToken}`);
    expect(me.status).toBe(401);
    expect(responseErrorCode(me)).toBe('SESSION_CLOSED');

    const rejoin = await request(app).post('/api/public/sessions/join').send({
      qrToken,
      pin: tablePin,
    });
    expect(rejoin.status).toBe(403);
  });

  it('rejects join on expired sessions', async () => {
    const opened = await request(app)
      .post(`/api/admin/tables/${tableId}/sessions`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const pin = opened.body.pin as string;
    const expiredSessionId = opened.body.session.id as string;

    const openedAt = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() - 60_000);
    await prisma.tableSession.update({
      where: { id: expiredSessionId },
      data: { openedAt, expiresAt },
    });

    const response = await request(app).post('/api/public/sessions/join').send({ qrToken, pin });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TABLE_NOT_OPEN');
  });

  it('auto-opens sessions when require_staff_open is false', async () => {
    await prisma.order.deleteMany({ where: { tableId } });
    await prisma.tableSession.deleteMany({ where: { tableId } });
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { requireStaffOpen: false },
    });

    const joined = await request(app).post('/api/public/sessions/join').send({ qrToken });
    expect(joined.status).toBe(200);
    expect(joined.body.accessToken).toEqual(expect.any(String));
  });
});

function responseErrorCode(response: { body: { error?: { code?: string } } }): string | undefined {
  return response.body.error?.code;
}
