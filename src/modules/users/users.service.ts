import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { UserModel, IUser } from './users.model';
import { RegisterUserDto, UpdateUserDto, QueryUsersDto } from './users.validation';
import { ConflictError, NotFoundError, BadRequestError, USER_ROLES } from '../../core';

const BCRYPT_SALT_ROUNDS = 12;

export interface PaginatedUsersResult {
  users: IUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class UsersService {
  public async createUser(dto: RegisterUserDto, tenantId?: string | null): Promise<IUser> {
    const normalizedEmail = dto.email.toLowerCase();

    const existingUser = await UserModel.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    let parsedTenantId: Types.ObjectId | null = null;
    const effectiveTenantId = tenantId ?? dto.tenantId;

    if (effectiveTenantId) {
      if (!Types.ObjectId.isValid(effectiveTenantId)) {
        throw new BadRequestError('Invalid tenant identifier format');
      }
      parsedTenantId = new Types.ObjectId(effectiveTenantId);
    }

    const user = await UserModel.create({
      name: dto.name,
      email: normalizedEmail,
      password: hashedPassword,
      role: dto.role ?? USER_ROLES.USER,
      tenantId: parsedTenantId,
    });

    return user;
  }

  public async getUserById(userId: string, tenantId?: string | null): Promise<IUser> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    const filter: Record<string, unknown> = { _id: new Types.ObjectId(userId) };
    if (tenantId) {
      if (!Types.ObjectId.isValid(tenantId)) {
        throw new BadRequestError('Invalid tenant identifier format');
      }
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    const user = await UserModel.findOne(filter);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  public async getUserByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() });
  }

  public async getUserWithPasswordByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() }).select('+password');
  }

  public async updateUser(
    userId: string,
    dto: UpdateUserDto,
    tenantId?: string | null,
  ): Promise<IUser> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestError('Invalid user ID format');
    }

    const filter: Record<string, unknown> = { _id: new Types.ObjectId(userId) };
    if (tenantId) {
      if (!Types.ObjectId.isValid(tenantId)) {
        throw new BadRequestError('Invalid tenant identifier format');
      }
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase();
      const existingEmailOwner = await UserModel.findOne({
        email: normalizedEmail,
        _id: { $ne: new Types.ObjectId(userId) },
      }).lean();

      if (existingEmailOwner) {
        throw new ConflictError('Email address is already in use by another account');
      }
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      filter,
      { $set: dto },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      throw new NotFoundError('User not found');
    }

    return updatedUser;
  }

  public async listUsers(
    query: QueryUsersDto,
    tenantId?: string | null,
  ): Promise<PaginatedUsersResult> {
    const filter: Record<string, unknown> = {};

    if (tenantId) {
      if (!Types.ObjectId.isValid(tenantId)) {
        throw new BadRequestError('Invalid tenant identifier format');
      }
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    if (query.role) {
      filter.role = query.role;
    }

    if (query.search && query.search.trim().length > 0) {
      filter.$or = [
        { name: { $regex: query.search.trim(), $options: 'i' } },
        { email: { $regex: query.search.trim(), $options: 'i' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;

    const [users, total] = await Promise.all([
      UserModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
      UserModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      users,
      total,
      page: query.page,
      limit: query.limit,
      totalPages,
    };
  }
}

export const usersService = new UsersService();
