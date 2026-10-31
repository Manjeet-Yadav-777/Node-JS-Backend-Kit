import { describe, it, expect } from 'vitest';
import {
  registerUserSchema,
  loginUserSchema,
  updateUserSchema,
  queryUsersSchema,
} from '../../../src/modules/users';
import { USER_ROLES } from '../../../src/core';

describe('User Module Zod Validation Schemas', () => {
  describe('registerUserSchema', () => {
    it('should validate and normalize valid registration data', () => {
      const payload = {
        name: '  Manjeet Yadav  ',
        email: 'MANJEET@EXAMPLE.COM',
        password: 'Password123',
      };

      const result = registerUserSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Manjeet Yadav');
        expect(result.data.email).toBe('manjeet@example.com');
        expect(result.data.role).toBe(USER_ROLES.USER);
      }
    });

    it('should reject invalid email and weak password', () => {
      const payload = {
        name: 'M',
        email: 'invalid-email',
        password: 'weak',
      };

      const result = registerUserSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues.map((i) => i.path[0]);
        expect(issues).toContain('name');
        expect(issues).toContain('email');
        expect(issues).toContain('password');
      }
    });
  });

  describe('loginUserSchema', () => {
    it('should validate valid credentials', () => {
      const result = loginUserSchema.safeParse({
        email: 'TEST@EXAMPLE.COM',
        password: 'Password123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });

    it('should fail when password is empty', () => {
      const result = loginUserSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('queryUsersSchema', () => {
    it('should coerce query strings into numbers and provide defaults', () => {
      const result = queryUsersSchema.safeParse({
        page: '2',
        limit: '15',
        role: 'admin',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(15);
        expect(result.data.role).toBe(USER_ROLES.ADMIN);
      }
    });
  });

  describe('updateUserSchema', () => {
    it('should allow partial valid updates', () => {
      const result = updateUserSchema.safeParse({
        name: 'New Name',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('New Name');
        expect(result.data.email).toBeUndefined();
      }
    });
  });
});
