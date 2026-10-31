import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { AuthController } from '../../../src/modules/auth/auth.controller';
import { authService } from '../../../src/modules/auth/auth.service';
import { usersService } from '../../../src/modules/users/users.service';
import { IUser } from '../../../src/modules/users/users.model';
import { Types } from 'mongoose';

describe('AuthController', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: NextFunction;
  let cookieMock: ReturnType<typeof vi.fn>;
  let clearCookieMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    cookieMock = vi.fn();
    clearCookieMock = vi.fn();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      body: {},
      cookies: {},
      headers: {},
      tenantId: 'tenant_123',
    } as unknown as Request;

    mockResponse = {
      status: statusMock,
      json: jsonMock,
      cookie: cookieMock,
      clearCookie: clearCookieMock,
    } as unknown as Response;

    mockNext = vi.fn();
  });

  describe('register', () => {
    it('should set httpOnly cookies and return 201 with auth payload', async () => {
      const mockResult = {
        user: { _id: new Types.ObjectId(), name: 'Test' } as unknown as IUser,
        accessToken: 'access_token_123',
        refreshToken: 'refresh_token_456',
      };

      vi.spyOn(authService, 'register').mockResolvedValue(mockResult);

      mockRequest.body = {
        name: 'Test',
        email: 'test@example.com',
        password: 'Password123',
      };

      await AuthController.register(mockRequest, mockResponse, mockNext);

      expect(cookieMock).toHaveBeenCalledWith(
        'accessToken',
        'access_token_123',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(cookieMock).toHaveBeenCalledWith(
        'refreshToken',
        'refresh_token_456',
        expect.objectContaining({ httpOnly: true, path: '/api/v1/auth' }),
      );
      expect(statusMock).toHaveBeenCalledWith(201);
    });
  });

  describe('login', () => {
    it('should set cookies and return 200 on valid credentials', async () => {
      const mockResult = {
        user: { _id: new Types.ObjectId(), name: 'Test' } as unknown as IUser,
        accessToken: 'access_123',
        refreshToken: 'refresh_456',
      };

      vi.spyOn(authService, 'login').mockResolvedValue(mockResult);

      mockRequest.body = {
        email: 'test@example.com',
        password: 'Password123',
      };

      await AuthController.login(mockRequest, mockResponse, mockNext);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(cookieMock).toHaveBeenCalledWith('accessToken', 'access_123', expect.any(Object));
      expect(cookieMock).toHaveBeenCalledWith('refreshToken', 'refresh_456', expect.any(Object));
    });
  });

  describe('refreshToken', () => {
    it('should read from cookie and rotate tokens', async () => {
      const mockRefreshResult = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
      };

      vi.spyOn(authService, 'refreshTokens').mockResolvedValue(mockRefreshResult);
      mockRequest.cookies = { refreshToken: 'old_cookie_token' };

      await AuthController.refreshToken(mockRequest, mockResponse, mockNext);

      expect(authService.refreshTokens).toHaveBeenCalledWith('old_cookie_token');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(cookieMock).toHaveBeenCalledWith(
        'accessToken',
        'new_access_token',
        expect.any(Object),
      );
    });

    it('should forward error to next when no refresh token is provided', async () => {
      mockRequest.cookies = {};
      mockRequest.body = {};

      await AuthController.refreshToken(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('logout', () => {
    it('should clear cookies and call service logout', async () => {
      vi.spyOn(authService, 'logout').mockResolvedValue();
      mockRequest.user = { userId: 'user_123', role: 'user' };

      await AuthController.logout(mockRequest, mockResponse, mockNext);

      expect(clearCookieMock).toHaveBeenCalledWith('accessToken', { path: '/' });
      expect(clearCookieMock).toHaveBeenCalledWith('refreshToken', { path: '/api/v1/auth' });
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe('getMe', () => {
    it('should return profile of currently authenticated user', async () => {
      const mockUser = { _id: new Types.ObjectId(), email: 'me@example.com' } as unknown as IUser;
      vi.spyOn(usersService, 'getUserById').mockResolvedValue(mockUser);
      mockRequest.user = { userId: 'me_id', role: 'user', tenantId: 'tenant_id' };

      await AuthController.getMe(mockRequest, mockResponse, mockNext);

      expect(usersService.getUserById).toHaveBeenCalledWith('me_id', 'tenant_id');
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });
});
