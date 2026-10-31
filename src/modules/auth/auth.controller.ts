import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { usersService } from '../users/users.service';
import { RegisterUserDto, LoginUserDto } from '../users/users.validation';
import { ApiResponse, UnauthorizedError } from '../../core';
import { env } from '../../config';

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

const getCookieOptions = (maxAge: number, path = '/') => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: (env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  maxAge,
  path,
});

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body as RegisterUserDto, req.tenantId);

      res.cookie('accessToken', result.accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
      res.cookie(
        'refreshToken',
        result.refreshToken,
        getCookieOptions(REFRESH_TOKEN_MAX_AGE, '/api/v1/auth'),
      );

      ApiResponse.success(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        'User registered successfully',
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body as LoginUserDto, req.tenantId);

      res.cookie('accessToken', result.accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
      res.cookie(
        'refreshToken',
        result.refreshToken,
        getCookieOptions(REFRESH_TOKEN_MAX_AGE, '/api/v1/auth'),
      );

      ApiResponse.success(
        res,
        {
          user: result.user,
          accessToken: result.accessToken,
        },
        'Login successful',
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  public static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token =
        (req.cookies as Record<string, string> | undefined)?.refreshToken ??
        (req.body as { refreshToken?: string }).refreshToken;

      if (!token || typeof token !== 'string' || token.trim().length === 0) {
        throw new UnauthorizedError('Refresh token is required');
      }

      const result = await authService.refreshTokens(token.trim());

      res.cookie('accessToken', result.accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE));
      res.cookie(
        'refreshToken',
        result.refreshToken,
        getCookieOptions(REFRESH_TOKEN_MAX_AGE, '/api/v1/auth'),
      );

      ApiResponse.success(
        res,
        { accessToken: result.accessToken },
        'Tokens refreshed successfully',
        200,
      );
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.userId) {
        await authService.logout(req.user.userId);
      }

      res.clearCookie('accessToken', { path: '/' });
      res.clearCookie('refreshToken', { path: '/api/v1/auth' });

      ApiResponse.success(res, null, 'Logged out successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.getUserById(req.user!.userId, req.user!.tenantId);
      ApiResponse.success(res, user, 'Authenticated user profile', 200);
    } catch (error) {
      next(error);
    }
  }
}
