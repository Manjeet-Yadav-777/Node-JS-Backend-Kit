import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { usersService, UserModel, IUser, RegisterUserDto, LoginUserDto } from '../users';
import { JwtUtil, UnauthorizedError, BadRequestError } from '../../core';
import { enqueueWelcomeEmail, enqueuePasswordResetEmail } from '../../jobs';

const REFRESH_TOKEN_SALT_ROUNDS = 10;
const PASSWORD_SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

export interface AuthResult {
  user: IUser;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  public async register(dto: RegisterUserDto, tenantId?: string | null): Promise<AuthResult> {
    const user = await usersService.createUser(dto, tenantId);

    const userTenantId = user.tenantId ? user.tenantId.toHexString() : null;
    const tokenPayload = {
      userId: (user._id as Types.ObjectId).toHexString(),
      role: user.role,
      tenantId: userTenantId,
    };

    const accessToken = JwtUtil.generateAccessToken(tokenPayload);
    const refreshToken = JwtUtil.generateRefreshToken(tokenPayload);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, REFRESH_TOKEN_SALT_ROUNDS);
    await UserModel.updateOne({ _id: user._id }, { $set: { refreshToken: hashedRefreshToken } });

    await enqueueWelcomeEmail({
      to: user.email,
      name: user.name,
      userId: (user._id as Types.ObjectId).toHexString(),
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  public async login(dto: LoginUserDto, tenantId?: string | null): Promise<AuthResult> {
    const user = await usersService.getUserWithPasswordByEmail(dto.email);

    if (!user || !user.password) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const effectiveTenantId = user.tenantId ? user.tenantId.toHexString() : (tenantId ?? null);
    const tokenPayload = {
      userId: (user._id as Types.ObjectId).toHexString(),
      role: user.role,
      tenantId: effectiveTenantId,
    };

    const accessToken = JwtUtil.generateAccessToken(tokenPayload);
    const refreshToken = JwtUtil.generateRefreshToken(tokenPayload);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, REFRESH_TOKEN_SALT_ROUNDS);
    await UserModel.updateOne({ _id: user._id }, { $set: { refreshToken: hashedRefreshToken } });

    user.password = undefined;

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  public async refreshTokens(incomingRefreshToken: string): Promise<RefreshResult> {
    const decoded = JwtUtil.verifyRefreshToken(incomingRefreshToken);

    const user = await UserModel.findById(decoded.userId).select('+refreshToken');
    if (!user || !user.refreshToken) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const isTokenValid = await bcrypt.compare(incomingRefreshToken, user.refreshToken);
    if (!isTokenValid) {
      await UserModel.updateOne({ _id: user._id }, { $unset: { refreshToken: 1 } });
      throw new UnauthorizedError('Invalid or reused refresh token');
    }

    const userTenantId = user.tenantId ? user.tenantId.toHexString() : null;
    const tokenPayload = {
      userId: (user._id as Types.ObjectId).toHexString(),
      role: user.role,
      tenantId: userTenantId,
    };

    const newAccessToken = JwtUtil.generateAccessToken(tokenPayload);
    const newRefreshToken = JwtUtil.generateRefreshToken(tokenPayload);

    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, REFRESH_TOKEN_SALT_ROUNDS);
    await UserModel.updateOne({ _id: user._id }, { $set: { refreshToken: hashedRefreshToken } });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  public async logout(userId: string): Promise<void> {
    await UserModel.updateOne({ _id: userId }, { $unset: { refreshToken: 1 } });
  }

  public async forgotPassword(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: normalizedEmail });

    if (!user) {
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRATION_MS);

    await UserModel.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordResetToken: hashedResetToken,
          passwordResetExpires: expiresAt,
        },
      },
    );

    await enqueuePasswordResetEmail({
      to: user.email,
      resetToken,
      expiresInMinutes: 15,
    });
  }

  public async resetPassword(token: string, newPassword: string): Promise<void> {
    const hashedToken = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const user = await UserModel.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password');

    if (!user) {
      throw new BadRequestError('Password reset token is invalid or has expired');
    }

    const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshToken = undefined;

    await user.save();
  }
}

export const authService = new AuthService();
