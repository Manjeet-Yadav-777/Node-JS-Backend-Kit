import jwt, { SignOptions, JwtPayload as StandardJwtPayload } from 'jsonwebtoken';
import { env } from '../../config';
import { UnauthorizedError } from '../errors';

export interface JwtTokenPayload {
  userId: string;
  role: string;
  tenantId?: string | null;
}

export class JwtUtil {
  public static generateAccessToken(payload: JwtTokenPayload): string {
    const options: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
  }

  public static generateRefreshToken(payload: JwtTokenPayload): string {
    const options: SignOptions = {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
    };

    return jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
  }

  public static verifyAccessToken(token: string): JwtTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as StandardJwtPayload &
        JwtTokenPayload;

      return {
        userId: decoded.userId,
        role: decoded.role,
        tenantId: decoded.tenantId ?? null,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token has expired');
      }
      throw new UnauthorizedError('Invalid or corrupted access token');
    }
  }

  public static verifyRefreshToken(token: string): JwtTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as StandardJwtPayload &
        JwtTokenPayload;

      return {
        userId: decoded.userId,
        role: decoded.role,
        tenantId: decoded.tenantId ?? null,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Refresh token has expired');
      }
      throw new UnauthorizedError('Invalid or corrupted refresh token');
    }
  }
}
