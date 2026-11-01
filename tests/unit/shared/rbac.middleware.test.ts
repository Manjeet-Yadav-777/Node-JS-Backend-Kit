import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authorize } from '../../../src/shared';
import { ForbiddenError, UnauthorizedError, USER_ROLES } from '../../../src/core';

describe('RBAC Middleware (authorize)', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockRequest = {} as Request;
    mockResponse = {} as Response;
    mockNext = vi.fn();
  });

  it('should throw UnauthorizedError when req.user is missing', () => {
    const middleware = authorize(USER_ROLES.ADMIN);

    expect(() => middleware(mockRequest, mockResponse, mockNext)).toThrow(UnauthorizedError);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenError when user does not have required role', () => {
    mockRequest.user = {
      userId: 'user_123',
      role: USER_ROLES.USER,
    };

    const middleware = authorize(USER_ROLES.ADMIN);

    expect(() => middleware(mockRequest, mockResponse, mockNext)).toThrow(ForbiddenError);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should invoke next when user has one of the allowed roles', () => {
    mockRequest.user = {
      userId: 'admin_999',
      role: USER_ROLES.ADMIN,
    };

    const middleware = authorize(USER_ROLES.USER, USER_ROLES.ADMIN);

    middleware(mockRequest, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});
