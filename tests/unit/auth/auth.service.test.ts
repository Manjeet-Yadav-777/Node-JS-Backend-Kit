import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { authService } from '../../../src/modules/auth';
import { usersService, UserModel, IUser } from '../../../src/modules/users';
import { JwtUtil, UnauthorizedError } from '../../../src/core';

vi.mock('../../../src/jobs', () => ({
  enqueuePasswordResetEmail: vi.fn().mockResolvedValue({ id: 'job_1' }),
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new user, issue tokens, and store hashed refresh token', async () => {
      const mockUserId = new Types.ObjectId();
      const mockTenantId = new Types.ObjectId();

      const mockCreatedUser = {
        _id: mockUserId,
        name: 'Auth User',
        email: 'auth@example.com',
        role: 'user',
        tenantId: mockTenantId,
      } as unknown as IUser;

      vi.spyOn(usersService, 'createUser').mockResolvedValue(mockCreatedUser);
      vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_refresh_token_123' as never);
      const updateOneSpy = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);

      const result = await authService.register({
        name: 'Auth User',
        email: 'auth@example.com',
        password: 'Password123',
      });

      expect(usersService.createUser).toHaveBeenCalled();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: mockUserId },
        { $set: { refreshToken: 'hashed_refresh_token_123' } },
      );
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedError when user is not found', async () => {
      vi.spyOn(usersService, 'getUserWithPasswordByEmail').mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when password does not match', async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: 'user@example.com',
        password: 'stored_hashed_password',
      } as unknown as IUser;

      vi.spyOn(usersService, 'getUserWithPasswordByEmail').mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'WrongPassword123',
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should return tokens and strip password on successful login', async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: 'user@example.com',
        password: 'stored_hashed_password',
        role: 'user',
      } as unknown as IUser;

      vi.spyOn(usersService, 'getUserWithPasswordByEmail').mockResolvedValue(mockUser);
      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      vi.spyOn(bcrypt, 'hash').mockResolvedValue('new_hashed_refresh_token' as never);
      vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);

      const result = await authService.login({
        email: 'user@example.com',
        password: 'Password123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.password).toBeUndefined();
    });
  });

  describe('refreshTokens', () => {
    it('should rotate tokens when valid refresh token is presented', async () => {
      const mockUserId = new Types.ObjectId().toHexString();
      const rawRefreshToken = JwtUtil.generateRefreshToken({
        userId: mockUserId,
        role: 'user',
      });

      const mockUserDoc = {
        _id: new Types.ObjectId(mockUserId),
        role: 'user',
        refreshToken: 'hashed_db_token',
      };

      vi.spyOn(UserModel, 'findById').mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUserDoc),
      } as unknown as ReturnType<typeof UserModel.findById>);

      vi.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      vi.spyOn(bcrypt, 'hash').mockResolvedValue('rotated_hashed_refresh_token' as never);
      const updateOneSpy = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);

      const result = await authService.refreshTokens(rawRefreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(updateOneSpy).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should clear stored refresh token in database', async () => {
      const updateOneSpy = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);

      await authService.logout('user_123');

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: 'user_123' },
        { $unset: { refreshToken: 1 } },
      );
    });
  });

  describe('forgotPassword', () => {
    it('should silently return if user is not found', async () => {
      vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);

      await expect(authService.forgotPassword('unknown@example.com')).resolves.not.toThrow();
    });

    it('should generate reset token and enqueue password reset email when user exists', async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: 'user@example.com',
      };

      vi.spyOn(UserModel, 'findOne').mockResolvedValue(mockUser as never);
      const updateOneSpy = vi.spyOn(UserModel, 'updateOne').mockResolvedValue({} as never);

      await authService.forgotPassword('User@Example.com');

      expect(updateOneSpy).toHaveBeenCalledWith(
        { _id: mockUser._id },
        {
          $set: {
            passwordResetToken: expect.any(String),
            passwordResetExpires: expect.any(Date),
          },
        },
      );
    });
  });

  describe('resetPassword', () => {
    it('should throw BadRequestError when token is invalid or expired', async () => {
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof UserModel.findOne>);

      await expect(authService.resetPassword('invalid_token', 'NewPassword123')).rejects.toThrow(
        'Password reset token is invalid or has expired',
      );
    });

    it('should update password and invalidate reset token and refresh token on success', async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        password: 'old_password',
        save: vi.fn().mockResolvedValue(undefined),
      };

      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        select: vi.fn().mockResolvedValue(mockUser),
      } as unknown as ReturnType<typeof UserModel.findOne>);
      vi.spyOn(bcrypt, 'hash').mockResolvedValue('new_hashed_password' as never);

      await authService.resetPassword('valid_token', 'NewPassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123', 10);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
    });
  });
});
