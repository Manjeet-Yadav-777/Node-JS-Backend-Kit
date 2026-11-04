import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../../src/app';

describe('Health and Readiness Probes', () => {
  const app = createApp();

  it('GET /health should return 200 with comprehensive service report', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBeDefined();
    expect(response.body.data.uptime).toBeTypeOf('number');
    expect(response.body.data.services).toBeDefined();
    expect(response.body.data.services.database).toBeDefined();
    expect(response.body.data.services.redis).toBeDefined();
    expect(response.body.data.services.kafka).toBeDefined();
  });

  it('GET /health/live should pass liveness probe with process memory and uptime', async () => {
    const response = await request(app).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('alive');
    expect(response.body.data.uptime).toBeTypeOf('number');
    expect(response.body.data.memory).toBeDefined();
    expect(response.body.data.memory.rssMb).toBeTypeOf('number');
    expect(response.body.data.memory.heapTotalMb).toBeTypeOf('number');
    expect(response.body.data.memory.heapUsedMb).toBeTypeOf('number');
  });

  it('GET /health/ready should pass readiness probe', async () => {
    const response = await request(app).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ready');
    expect(response.body.data.dependencies).toBeDefined();
    expect(response.body.data.dependencies.database).toBeDefined();
    expect(response.body.data.dependencies.redis).toBeDefined();
    expect(response.body.data.dependencies.kafka).toBeDefined();
  });

  it('GET /healthz/live and /healthz/ready should also work for Kubernetes compatibility', async () => {
    const livenessResponse = await request(app).get('/healthz/live');
    expect(livenessResponse.status).toBe(200);
    expect(livenessResponse.body.data.status).toBe('alive');

    const readinessResponse = await request(app).get('/healthz/ready');
    expect(readinessResponse.status).toBe(200);
    expect(readinessResponse.body.data.status).toBe('ready');
  });
});
