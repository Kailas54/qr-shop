import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app';

describe('HTTP shell', () => {
  it('GET / identifies the API and returns a request id', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: 'qr-ordering-api', status: 'ok' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('GET /health runs a database probe', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.db).toBe('up');
    expect(response.body.latencyMs).toEqual(expect.any(Number));
  });

  it('unknown routes use the error envelope', async () => {
    const response = await request(app).get('/missing');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found: GET /missing',
      },
    });
  });
});
