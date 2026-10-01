import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app';
import { isPusherConfigured } from './lib/pusher';
import { prisma } from './lib/db';

const OWNER_EMAIL = 'owner@demo.local';
const OWNER_PASSWORD = 'Owner@12345';

describe('Phase 6 customer public API', () => {
  it('exposes guest realtime config', async () => {
    const response = await request(app).get('/api/public/realtime-config');
    expect(response.status).toBe(200);
    expect(response.body.enabled).toBe(isPusherConfigured());
    expect(response.body.cluster).toEqual(expect.any(String));
  });

  it('returns sessionId when joining a table', async () => {
    const table = await prisma.table.findFirst({
      where: { tableNumber: '1', restaurant: { name: 'Demo Restaurant' } },
      select: { id: true, qrToken: true },
    });
    expect(table).not.toBeNull();

    await prisma.order.deleteMany({ where: { tableId: table!.id } });
    await prisma.tableSession.deleteMany({ where: { tableId: table!.id } });

    const login = await request(app).post('/api/admin/auth/login').send({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
    });
    const opened = await request(app)
      .post(`/api/admin/tables/${table!.id}/sessions`)
      .set('Authorization', `Bearer ${login.body.accessToken}`);

    const joined = await request(app).post('/api/public/sessions/join').send({
      qrToken: table!.qrToken,
      pin: opened.body.pin,
    });

    expect(joined.status).toBe(200);
    expect(joined.body.sessionId).toEqual(opened.body.session.id);
    expect(joined.body.accessToken).toEqual(expect.any(String));

    const me = await request(app)
      .get('/api/public/sessions/me')
      .set('Authorization', `Bearer ${joined.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.sessionId).toBe(opened.body.session.id);
  });
});
