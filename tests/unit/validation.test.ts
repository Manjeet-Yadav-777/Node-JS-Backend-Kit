import { describe, it, expect } from 'vitest';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateRequest, errorMiddleware } from '../../src/shared';
import { ApiResponse } from '../../src/core';

describe('Validation Middleware', () => {
  const schema = {
    body: z.object({
      email: z.string().email(),
      age: z.number().min(18),
    }),
    query: z.object({
      limit: z.coerce.number().min(1).max(100).optional(),
    }),
  };

  const app = express();
  app.use(express.json());

  app.post('/test-validate', validateRequest(schema), (req: Request, res: Response) => {
    ApiResponse.success(res, { body: req.body, query: req.query }, 'Validated successfully');
  });

  app.use(errorMiddleware);

  it('should pass validation when valid payload and query are provided', async () => {
    const response = await request(app)
      .post('/test-validate?limit=25')
      .send({ email: 'developer@example.com', age: 25 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.body.email).toBe('developer@example.com');
    expect(response.body.data.query.limit).toBe(25);
  });

  it('should return 400 VALIDATION_ERROR when invalid body is provided', async () => {
    const response = await request(app)
      .post('/test-validate')
      .send({ email: 'invalid-email', age: 15 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.details)).toBe(true);
    expect(response.body.error.details.length).toBeGreaterThanOrEqual(2);
  });
});
