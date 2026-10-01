import bcrypt from 'bcrypt';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from './app';
import { env } from './config/env';
import { prisma } from './lib/db';

const OWNER_EMAIL = 'owner@demo.local';
const OWNER_PASSWORD = 'Owner@12345';

describe('Phase 2 admin API', () => {
  let accessToken: string;
  let restaurantId: string;
  let categoryId: string;
  let tableId: string;
  let kitchenToken: string;

  beforeAll(async () => {
    const restaurant = await prisma.restaurant.findFirst({ where: { name: 'Demo Restaurant' } });
    if (restaurant) {
      await prisma.table.deleteMany({ where: { restaurantId: restaurant.id, tableNumber: 'P2-TEST' } });
      await prisma.menuItem.deleteMany({ where: { restaurantId: restaurant.id, name: 'Test Thali' } });
      await prisma.category.deleteMany({ where: { restaurantId: restaurant.id, name: 'Phase 2 Specials' } });
    }
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
      update: {
        passwordHash: kitchenHash,
        role: 'kitchen',
        restaurantId,
      },
    });

    const login = await request(app).post('/api/admin/auth/login').send({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    expect(login.status).toBe(200);
    accessToken = login.body.accessToken;
    expect(login.body.admin.role).toBe('owner');

    const kitchenLogin = await request(app).post('/api/admin/auth/login').send({
      email: 'kitchen@demo.local',
      password: 'Kitchen@12345',
    });
    kitchenToken = kitchenLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.menuItem.deleteMany({ where: { restaurantId, name: 'Test Thali' } });
    await prisma.category.deleteMany({ where: { restaurantId, name: 'Phase 2 Specials' } });
    await prisma.table.deleteMany({ where: { restaurantId, tableNumber: 'P2-TEST' } });
    await prisma.admin.deleteMany({ where: { email: 'kitchen@demo.local' } });
  });

  it('rejects invalid login credentials', async () => {
    const response = await request(app).post('/api/admin/auth/login').send({
      email: OWNER_EMAIL,
      password: 'wrong-password',
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /api/admin/me returns the authenticated profile', async () => {
    const response = await request(app).get('/api/admin/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.body.admin.email).toBe(OWNER_EMAIL);
    expect(response.body.admin.restaurant.name).toBe('Demo Restaurant');
  });

  it('refresh returns a new access token', async () => {
    const login = await request(app).post('/api/admin/auth/login').send({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    const response = await request(app)
      .post('/api/admin/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it('lists seeded tables and creates a new table with QR URL', async () => {
    const list = await request(app).get('/api/admin/tables').set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.tables.length).toBeGreaterThanOrEqual(10);
    tableId = list.body.tables[0].id;
    expect(list.body.tables[0].customerUrl).toContain('/t/');

    const created = await request(app)
      .post('/api/admin/tables')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tableNumber: 'P2-TEST' });
    expect(created.status).toBe(201);
    expect(created.body.table.customerUrl).toMatch(/^http:\/\/localhost:5173\/t\//);
  });

  it('returns a PNG QR code for a table', async () => {
    const response = await request(app)
      .get(`/api/admin/tables/${tableId}/qr?format=png`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/png');
    expect(response.body.length).toBeGreaterThan(100);
  });

  it('forbids kitchen staff from creating tables', async () => {
    const response = await request(app)
      .post('/api/admin/tables')
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ tableNumber: 'NOPE' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('manages menu categories and items with integer paise prices', async () => {
    const category = await request(app)
      .post('/api/admin/menu/categories')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Phase 2 Specials', sortOrder: 99 });
    expect(category.status).toBe(201);
    categoryId = category.body.category.id;

    const item = await request(app)
      .post('/api/admin/menu/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        categoryId,
        name: 'Test Thali',
        description: 'Integration test item',
        price: 45000,
        isVeg: true,
      });
    expect(item.status).toBe(201);
    expect(item.body.item.price).toBe(45000);

    const toggled = await request(app)
      .patch(`/api/admin/menu/items/${item.body.item.id}/availability`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ isAvailable: false });
    expect(toggled.status).toBe(200);
    expect(toggled.body.item.isAvailable).toBe(false);
  });

  it('downloads a ZIP of table QR codes', async () => {
    const response = await request(app)
      .get('/api/admin/tables/qr/bulk.zip')
      .set('Authorization', `Bearer ${accessToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('zip');
    expect((response.body as Buffer).byteLength).toBeGreaterThan(500);
    expect((response.body as Buffer).subarray(0, 2).toString('hex')).toBe('504b');
  });
});
