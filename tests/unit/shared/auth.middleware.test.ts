import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../src/shared';
import { JwtUtil, UnauthorizedError } from '../../../src/core';

describe('Auth Middleware (authenticate)', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: NextFunction;
  let setHeaderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    setHeaderMock = vi.fn();

    mockRequest = {
      headers: {},
    } as unknown as Request;

    mockResponse = {
      setHeader: setHeaderMock,
    } as unknown as Response;

    mockNext = vi.fn();
  });

  it('should throw UnauthorizedError when Authorization header is missing', () => {
    expect(() => authenticate(mockRequest, mockResponse, mockNext)).toThrow(UnauthorizedError);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when Authorization header does not start with Bearer', () => {
    mockRequest.headers = { authorization: 'Basic dXNlcjpwYXNz' };

    expect(() => authenticate(mockRequest, mockResponse, mockNext)).toThrow(UnauthorizedError);
  });

  it('should verify token, populate req.user, bind tenantId, and invoke next', () => {
    const validToken = JwtUtil.generateAccessToken({
      userId: 'user_456',
      role: 'admin',
      tenantId: 'tenant_org_789',
    });

    mockRequest.headers = { authorization: `Bearer ${validToken}` };

    authenticate(mockRequest, mockResponse, mockNext);

    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.userId).toBe('user_456');
    expect(mockRequest.user?.role).toBe('admin');
    expect(mockRequest.tenantId).toBe('tenant_org_789');
    expect(setHeaderMock).toHaveBeenCalledWith('x-tenant-id', 'tenant_org_789');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should verify token when passed via cookies.accessToken', () => {
    const validToken = JwtUtil.generateAccessToken({
      userId: 'cookie_user_123',
      role: 'user',
      tenantId: 'cookie_tenant_456',
    });

    mockRequest = {
      headers: {},
      cookies: { accessToken: validToken },
    } as unknown as Request;

    authenticate(mockRequest, mockResponse, mockNext);

    expect(mockRequest.user).toBeDefined();
    expect(mockRequest.user?.userId).toBe('cookie_user_123');
    expect(mockRequest.tenantId).toBe('cookie_tenant_456');
    expect(mockNext).toHaveBeenCalled();
  });
});
