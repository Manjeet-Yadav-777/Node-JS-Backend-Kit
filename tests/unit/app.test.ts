import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('App Foundation and Health Checks', () => {
  const app = createApp();

  it('GET /healthz should return 200 with healthy status', async () => {
    const response = await request(app).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBeDefined();
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('GET /api/v1 should return API root metadata', async () => {
    const response = await request(app).get('/api/v1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.version).toBe('1.0.0');
  });

  it('GET /api/v1/non-existent-route should return 404 standard error envelope', async () => {
    const response = await request(app).get('/api/v1/non-existent-route');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
