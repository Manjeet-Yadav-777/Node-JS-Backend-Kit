import { Request, Response, NextFunction } from 'express';
import { JwtUtil, UnauthorizedError } from '../../core';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token is missing or malformed');
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.trim().length === 0) {
    throw new UnauthorizedError('Authentication token is missing');
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
