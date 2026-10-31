import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const requestId = typeof existingId === 'string' ? existingId : randomUUID();

  req.id = requestId;
  res.setHeader('x-request-id', requestId);

  next();
}
