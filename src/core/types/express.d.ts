export interface AuthUser {
  userId: string;
  role: string;
  tenantId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
      tenantId?: string | null;
      user?: AuthUser;
    }
  }
}
