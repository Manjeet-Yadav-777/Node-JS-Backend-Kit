import { describe, it, expect } from 'vitest';
import { renderWelcomeEmail, renderPasswordResetEmail } from '../../../../src/infrastructure';

describe('Email Templates', () => {
  describe('renderWelcomeEmail', () => {
    it('should generate valid responsive HTML with user name and default URLs', () => {
      const html = renderWelcomeEmail({ name: 'Alexander' });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Welcome to Our Platform');
      expect(html).toContain('Hi <strong>Alexander</strong>');
      expect(html).toContain('http://localhost:5000/login');
      expect(html).toContain('support@example.com');
    });

    it('should allow custom loginUrl and supportEmail', () => {
      const html = renderWelcomeEmail({
        name: 'Samantha',
        loginUrl: 'https://app.example.com/signin',
        supportEmail: 'helpdesk@example.com',
      });

      expect(html).toContain('https://app.example.com/signin');
      expect(html).toContain('helpdesk@example.com');
    });
  });

  describe('renderPasswordResetEmail', () => {
    it('should generate valid responsive HTML with token and default expiration time', () => {
      const html = renderPasswordResetEmail({ resetToken: 'tok_abc_123' });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Password Reset Request');
      expect(html).toContain('tok_abc_123');
      expect(html).toContain('15 minutes');
      expect(html).toContain('Security Notice');
      expect(html).toContain('http://localhost:5000/api/v1/auth/reset-password?token=tok_abc_123');
    });

    it('should allow custom resetUrl and expiration duration', () => {
      const html = renderPasswordResetEmail({
        resetToken: 'raw_token_xyz',
        resetUrl: 'https://app.example.com/reset?code=raw_token_xyz',
        expiresInMinutes: 30,
        supportEmail: 'security@example.com',
      });

      expect(html).toContain('https://app.example.com/reset?code=raw_token_xyz');
      expect(html).toContain('30 minutes');
      expect(html).toContain('security@example.com');
    });
  });
});
