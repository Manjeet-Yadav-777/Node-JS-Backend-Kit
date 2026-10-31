import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { RegisterUserDto, UpdateUserDto, QueryUsersDto } from './users.validation';
import { ApiResponse } from '../../core';

export class UsersController {
  public static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await usersService.createUser(req.body as RegisterUserDto, req.tenantId);
      ApiResponse.success(res, user, 'User registered successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  public static async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await usersService.getUserById(id as string, req.tenantId);
      ApiResponse.success(res, user, 'User retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const user = await usersService.updateUser(
        id as string,
        req.body as UpdateUserDto,
        req.tenantId,
      );
      ApiResponse.success(res, user, 'User updated successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as QueryUsersDto;
      const result = await usersService.listUsers(query, req.tenantId);

      ApiResponse.success(res, result.users, 'Users retrieved successfully', 200, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  }
}
