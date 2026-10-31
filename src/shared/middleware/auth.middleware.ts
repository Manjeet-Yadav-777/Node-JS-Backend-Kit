import { Request, Response, NextFunction } from 'express';
import { JwtUtil, UnauthorizedError } from '../../core';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  const cookieToken = (req.cookies as Record<string, string> | undefined)?.accessToken;
  if (typeof cookieToken === 'string' && cookieToken.trim().length > 0) {
    token = cookieToken.trim();
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]?.trim();
  }

  if (!token) {
    throw new UnauthorizedError('Authentication token is missing or malformed');
  }

  const decoded = JwtUtil.verifyAccessToken(token);

  req.user = {
    userId: decoded.userId,
    role: decoded.role,
    tenantId: decoded.tenantId,
  };

  if (decoded.tenantId) {
    req.tenantId = decoded.tenantId;
    res.setHeader('x-tenant-id', decoded.tenantId);
  }

  next();
}
