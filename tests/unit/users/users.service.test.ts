import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { usersService, UserModel } from '../../../src/modules/users';
import { ConflictError, NotFoundError, BadRequestError } from '../../../src/core';

describe('UsersService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createUser', () => {
    it('should throw ConflictError if user with email already exists', async () => {
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: vi.fn().mockResolvedValue({ _id: new Types.ObjectId(), email: 'exists@example.com' }),
      } as unknown as ReturnType<typeof UserModel.findOne>);

      await expect(
        usersService.createUser({
          name: 'Existing User',
          email: 'exists@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow(ConflictError);
    });

    it('should throw BadRequestError if invalid tenantId is provided', async () => {
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof UserModel.findOne>);

      await expect(
        usersService.createUser(
          {
            name: 'Tenant User',
            email: 'tenant@example.com',
            password: 'Password123',
          },
          'invalid-tenant-id',
        ),
      ).rejects.toThrow(BadRequestError);
    });

    it('should hash password and create user successfully', async () => {
      const validTenantId = new Types.ObjectId().toHexString();
      vi.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as unknown as ReturnType<typeof UserModel.findOne>);

      const mockHash = vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password_123' as never);
      const mockCreate = vi.spyOn(UserModel, 'create').mockResolvedValue({
        _id: new Types.ObjectId(),
        name: 'New User',
        email: 'new@example.com',
        role: 'user',
        tenantId: new Types.ObjectId(validTenantId),
      } as never);

      const result = await usersService.createUser(
        {
          name: 'New User',
          email: 'new@example.com',
          password: 'Password123',
        },
        validTenantId,
      );

      expect(mockHash).toHaveBeenCalledWith('Password123', 12);
      expect(mockCreate).toHaveBeenCalled();
      expect(result.name).toBe('New User');
    });
  });

  describe('getUserById', () => {
    it('should throw BadRequestError on invalid user ID format', async () => {
      await expect(usersService.getUserById('invalid-id')).rejects.toThrow(BadRequestError);
    });

    it('should throw NotFoundError if user is not found', async () => {
      const validId = new Types.ObjectId().toHexString();
      vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);

      await expect(usersService.getUserById(validId)).rejects.toThrow(NotFoundError);
    });

    it('should return user when found', async () => {
      const validId = new Types.ObjectId().toHexString();
      const mockUser = { _id: new Types.ObjectId(validId), name: 'Found User' };
      vi.spyOn(UserModel, 'findOne').mockResolvedValue(mockUser as never);

      const result = await usersService.getUserById(validId);
      expect(result.name).toBe('Found User');
    });
  });
});
