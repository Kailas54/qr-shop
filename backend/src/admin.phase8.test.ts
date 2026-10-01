import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app';

describe('Phase 8 deployment surface', () => {
  it('serves OpenAPI spec', async () => {
    const response = await request(app).get('/api/openapi.yaml');
    expect(response.status).toBe(200);
    expect(response.text).toContain('openapi: 3.0.3');
    expect(response.text).toContain('/api/admin/auth/login');
  });
});
