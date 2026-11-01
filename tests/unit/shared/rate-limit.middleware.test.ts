import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { rateLimiter } from '../../../src/shared';
import { TooManyRequestsError } from '../../../src/core';

const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedisClient = {
  pipeline: vi.fn().mockReturnValue(mockPipeline),
};

const mockIsRedisConnected = vi.fn().mockReturnValue(true);

vi.mock('../../../src/infrastructure', () => ({
  getRedisClient: () => mockRedisClient,
  isRedisConnected: () => mockIsRedisConnected(),
}));

describe('Rate Limiter Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let headersSet: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRedisConnected.mockReturnValue(true);

    headersSet = {};
    mockRequest = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' } as unknown as Request['socket'],
    };
    mockResponse = {
      setHeader: vi.fn().mockImplementation((key: string, value: unknown) => {
        headersSet[key] = value;
      }),
    };
    mockNext = vi.fn();
  });

  it('should allow requests within the limit and set rate limit headers', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 5], // current count = 5
      [null, 'OK'],
    ]);

    const limiter = rateLimiter({ max: 10, windowMs: 60000 });
    await limiter(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 5);
    expect(headersSet['X-RateLimit-Reset']).toBeDefined();
  });

  it('should reject requests exceeding limit with TooManyRequestsError and set Retry-After', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 11], // current count = 11 (exceeds max 10)
      [null, 'OK'],
    ]);

    const limiter = rateLimiter({ max: 10, windowMs: 60000 });
    await limiter(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(TooManyRequestsError));
    expect(mockResponse.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 60);
  });

  it('should use user ID as rate limit key when req.user exists', async () => {
    mockRequest.user = { userId: 'user_456', role: 'user', tenantId: null };
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 'OK'],
    ]);

    const limiter = rateLimiter({ max: 5 });
    await limiter(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockPipeline.zadd).toHaveBeenCalledWith(
      'ratelimit:rl:user:user_456',
      expect.any(Number),
      expect.any(String),
    );
  });

  it('should use tenant ID as rate limit key when req.tenantId exists without req.user', async () => {
    mockRequest.tenantId = 'tenant_789';
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 'OK'],
    ]);

    const limiter = rateLimiter({ max: 5 });
    await limiter(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockPipeline.zadd).toHaveBeenCalledWith(
      'ratelimit:rl:tenant:tenant_789',
      expect.any(Number),
      expect.any(String),
    );
  });

  it('should skip rate limiting when skip function returns true', async () => {
    const limiter = rateLimiter({
      max: 5,
      skip: () => true,
    });

    await limiter(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
    expect(mockPipeline.exec).not.toHaveBeenCalled();
  });

  it('should fail open and call next() when Redis is disconnected', async () => {
    mockIsRedisConnected.mockReturnValue(false);

    const limiter = rateLimiter({ max: 5 });
    await limiter(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
    expect(mockPipeline.exec).not.toHaveBeenCalled();
  });

  it('should fail open and call next() when Redis pipeline execution throws', async () => {
    mockPipeline.exec.mockRejectedValue(new Error('Redis cluster down'));

    const limiter = rateLimiter({ max: 5 });
    await limiter(mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });
});
