import { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tenantId?: string | null;
    }
  }
}

export function tenantMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerTenant = req.headers['x-tenant-id'];

  if (typeof headerTenant === 'string' && headerTenant.trim().length > 0) {
    req.tenantId = headerTenant.trim();
    res.setHeader('x-tenant-id', req.tenantId);
  } else {
    req.tenantId = null;
  }

  next();
}
