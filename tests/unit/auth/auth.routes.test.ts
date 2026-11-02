import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { authService } from '../../../src/modules/auth';
import { usersService, IUser } from '../../../src/modules/users';
import { JwtUtil } from '../../../src/core';
import { Types } from 'mongoose';

describe('Auth Routes End-to-End Flow', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register user and set httpOnly cookies', async () => {
      const mockResult = {
        user: {
          _id: new Types.ObjectId(),
          name: 'Registered User',
          email: 'reg@example.com',
        } as unknown as IUser,
        accessToken: 'access_mock_token',
        refreshToken: 'refresh_mock_token',
      };

      vi.spyOn(authService, 'register').mockResolvedValue(mockResult);

      const response = await request(app).post('/api/v1/auth/register').send({
        name: 'Registered User',
        email: 'reg@example.com',
        password: 'Password123',
      });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('reg@example.com');
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should log in user and set auth cookies', async () => {
      const mockResult = {
        user: { _id: new Types.ObjectId(), email: 'login@example.com' } as unknown as IUser,
        accessToken: 'access_mock_token',
        refreshToken: 'refresh_mock_token',
      };

      vi.spyOn(authService, 'login').mockResolvedValue(mockResult);

      const response = await request(app).post('/api/v1/auth/login').send({
        email: 'login@example.com',
        password: 'Password123',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should reject unauthenticated request with 401', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return authenticated user profile when token cookie is provided', async () => {
      const mockUserId = new Types.ObjectId().toHexString();
      const token = JwtUtil.generateAccessToken({
        userId: mockUserId,
        role: 'user',
        tenantId: 'tenant_profile_123',
      });

      const mockUser = {
        _id: new Types.ObjectId(mockUserId),
        email: 'me@example.com',
        role: 'user',
      } as unknown as IUser;

      vi.spyOn(usersService, 'getUserById').mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', [`accessToken=${token}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('me@example.com');
      expect(response.headers['x-tenant-id']).toBe('tenant_profile_123');
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should validate email and dispatch forgot-password request', async () => {
      vi.spyOn(authService, 'forgotPassword').mockResolvedValue();

      const response = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'user@example.com',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset link has been sent');
    });

    it('should reject invalid email format with 400', async () => {
      const response = await request(app).post('/api/v1/auth/forgot-password').send({
        email: 'not-an-email',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('should validate token & password and reset password successfully', async () => {
      vi.spyOn(authService, 'resetPassword').mockResolvedValue();

      const response = await request(app).post('/api/v1/auth/reset-password').send({
        token: 'valid_reset_token',
        password: 'NewPassword123',
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password has been reset successfully');
    });

    it('should reject weak password with 400 validation error', async () => {
      const response = await request(app).post('/api/v1/auth/reset-password').send({
        token: 'valid_reset_token',
        password: 'weak',
      });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
