import { Request, Response, NextFunction } from 'express';
import { getRedisClient, isRedisConnected } from '../../infrastructure';
import { logger } from '../../config';
import { TooManyRequestsError } from '../../core';

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyPrefix?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

export function rateLimiter(options: RateLimitOptions = {}) {
  const {
    windowMs = 60 * 1000,
    max = 60,
    message = 'Too many requests from this client, please try again later',
    keyPrefix = 'rl',
    keyGenerator = (req: Request): string => {
      if (req.user?.userId) {
        return `user:${req.user.userId}`;
      }
      if (req.tenantId) {
        return `tenant:${req.tenantId}`;
      }
      const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
      return `ip:${clientIp}`;
    },
    skip = () => false,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (skip(req)) {
      return next();
    }

    // Fail open: If Redis is unavailable, allow requests to proceed
    if (!isRedisConnected()) {
      return next();
    }

    const identifier = keyGenerator(req);
    const redisKey = `ratelimit:${keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const member = `${now}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const client = getRedisClient();
      const pipeline = client.pipeline();

      pipeline.zremrangebyscore(redisKey, 0, windowStart);
      pipeline.zadd(redisKey, now, member);
      pipeline.zcard(redisKey);
      pipeline.pexpire(redisKey, windowMs);

      const results = await pipeline.exec();

      if (!results) {
        return next();
      }

      const zcardResult = results[2];
      const count = zcardResult && typeof zcardResult[1] === 'number' ? zcardResult[1] : 0;
      const resetTime = Math.ceil((now + windowMs) / 1000);
      const remaining = Math.max(0, max - count);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (count > max) {
        const retryAfterSeconds = Math.ceil(windowMs / 1000);
        res.setHeader('Retry-After', retryAfterSeconds);
        return next(new TooManyRequestsError(message));
      }

      return next();
    } catch (error) {
      logger.warn({ key: redisKey, error }, 'Rate limiter Redis failure - failing open');
      return next();
    }
  };
}
