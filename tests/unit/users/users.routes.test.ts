import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { usersService, IUser } from '../../../src/modules/users';
import { Types } from 'mongoose';

describe('Users Routes End-to-End Flow', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/users', () => {
    it('should reject invalid registration request with 400 VALIDATION_ERROR', async () => {
      const response = await request(app).post('/api/v1/users').send({
        name: 'M',
        email: 'invalid-email',
        password: 'weak',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should create user and return 201 when payload is valid', async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        name: 'Valid User',
        email: 'valid@example.com',
        role: 'user',
      } as unknown as IUser;

      vi.spyOn(usersService, 'createUser').mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/v1/users')
        .set('x-tenant-id', 'org_corp_123')
        .send({
          name: 'Valid User',
          email: 'valid@example.com',
          password: 'Password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Valid User');
      expect(response.headers['x-tenant-id']).toBe('org_corp_123');
    });
  });

  describe('GET /api/v1/users', () => {
    it('should return 200 with users and pagination metadata', async () => {
      vi.spyOn(usersService, 'listUsers').mockResolvedValue({
        users: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const response = await request(app).get('/api/v1/users?page=1&limit=20');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.meta.page).toBe(1);
    });
  });
});
