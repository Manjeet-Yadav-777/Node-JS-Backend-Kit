import { z } from 'zod';
import { USER_ROLES, APP_CONSTANTS } from '../../core';

export const registerUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    ),
  role: z.enum([USER_ROLES.USER, USER_ROLES.ADMIN]).optional().default(USER_ROLES.USER),
  tenantId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid tenantId format')
    .optional()
    .nullable(),
});

export const loginUserSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
});

export const queryUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(APP_CONSTANTS.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(APP_CONSTANTS.MAX_PAGE_LIMIT)
    .default(APP_CONSTANTS.DEFAULT_LIMIT),
  search: z.string().trim().optional(),
  role: z.enum([USER_ROLES.USER, USER_ROLES.ADMIN]).optional(),
});

export type RegisterUserDto = z.input<typeof registerUserSchema>;
export type LoginUserDto = z.infer<typeof loginUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type QueryUsersDto = z.infer<typeof queryUsersSchema>;
