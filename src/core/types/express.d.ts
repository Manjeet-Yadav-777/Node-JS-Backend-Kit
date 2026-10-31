export {};

declare global {
  namespace Express {
    interface Request {
      id?: string;
      tenantId?: string | null;
      user?: unknown;
    }
  }
}
