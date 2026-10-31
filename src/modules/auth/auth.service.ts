import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { usersService, UserModel, IUser, RegisterUserDto, LoginUserDto } from '../users';
import { JwtUtil, UnauthorizedError } from '../../core';

const REFRESH_TOKEN_SALT_ROUNDS = 10;

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
}

export const authService = new AuthService();
