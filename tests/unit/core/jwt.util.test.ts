import { describe, it, expect } from 'vitest';
import { JwtUtil, UnauthorizedError } from '../../../src/core';

describe('JwtUtil', () => {
  const payload = {
    userId: 'user_123456789',
    role: 'admin',
    tenantId: 'tenant_enterprise_001',
  };

  describe('Access Tokens', () => {
    it('should generate a valid access token and successfully verify it', () => {
      const token = JwtUtil.generateAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);

      const decoded = JwtUtil.verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.tenantId).toBe(payload.tenantId);
    });

    it('should preserve null tenantId when omitted', () => {
      const singleTenantPayload = {
        userId: 'user_b2c_999',
        role: 'user',
      };

      const token = JwtUtil.generateAccessToken(singleTenantPayload);
      const decoded = JwtUtil.verifyAccessToken(token);

      expect(decoded.userId).toBe(singleTenantPayload.userId);
      expect(decoded.role).toBe(singleTenantPayload.role);
      expect(decoded.tenantId).toBeNull();
    });

    it('should throw UnauthorizedError when token is corrupted', () => {
      expect(() => JwtUtil.verifyAccessToken('invalid.token.signature')).toThrow(UnauthorizedError);
    });
  });

  describe('Refresh Tokens', () => {
    it('should generate a valid refresh token and successfully verify it', () => {
      const token = JwtUtil.generateRefreshToken(payload);
      expect(typeof token).toBe('string');

      const decoded = JwtUtil.verifyRefreshToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.role).toBe(payload.role);
      expect(decoded.tenantId).toBe(payload.tenantId);
    });

    it('should throw UnauthorizedError when refresh token is corrupted', () => {
      expect(() => JwtUtil.verifyRefreshToken('invalid.refresh.token')).toThrow(UnauthorizedError);
    });
  });
});
