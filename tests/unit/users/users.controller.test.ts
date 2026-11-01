import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { UsersController, usersService, IUser } from '../../../src/modules/users';
import { Types } from 'mongoose';

describe('UsersController', () => {
  let mockRequest: Request;
  let mockResponse: Response;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      body: {},
      params: {},
      query: {},
      tenantId: 'tenant_123',
    } as unknown as Request;

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;

    mockNext = vi.fn();
  });

  describe('createUser', () => {
    it('should delegate to usersService and return 201 on success', async () => {
      const mockCreatedUser = {
        _id: new Types.ObjectId(),
        name: 'Test User',
        email: 'test@example.com',
      } as unknown as IUser;

      vi.spyOn(usersService, 'createUser').mockResolvedValue(mockCreatedUser);

      mockRequest.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
      };

      await UsersController.createUser(mockRequest, mockResponse, mockNext);

      expect(usersService.createUser).toHaveBeenCalledWith(mockRequest.body, 'tenant_123');
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          statusCode: 201,
          message: 'User registered successfully',
          data: mockCreatedUser,
        }),
      );
    });

    it('should invoke next with error when service throws', async () => {
      const error = new Error('Service error');
      vi.spyOn(usersService, 'createUser').mockRejectedValue(error);

      await UsersController.createUser(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getUserById', () => {
    it('should retrieve user and return 200', async () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        name: 'Found User',
      } as unknown as IUser;

      vi.spyOn(usersService, 'getUserById').mockResolvedValue(mockUser);
      mockRequest.params = { id: '654321654321654321654321' };

      await UsersController.getUserById(mockRequest, mockResponse, mockNext);

      expect(usersService.getUserById).toHaveBeenCalledWith(
        '654321654321654321654321',
        'tenant_123',
      );
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockUser,
        }),
      );
    });
  });

  describe('listUsers', () => {
    it('should return paginated user list with metadata', async () => {
      const mockResult = {
        users: [{ _id: new Types.ObjectId(), name: 'User 1' } as unknown as IUser],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      };

      vi.spyOn(usersService, 'listUsers').mockResolvedValue(mockResult);
      mockRequest.query = { page: '1', limit: '10' };

      await UsersController.listUsers(mockRequest, mockResponse, mockNext);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResult.users,
          meta: {
            page: 1,
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        }),
      );
    });
  });
});
