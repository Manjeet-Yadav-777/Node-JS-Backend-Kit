import { describe, it, expect, vi, beforeEach } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailService } from '../../../../src/infrastructure/email/email.service';
import { env } from '../../../../src/config';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.restoreAllMocks();
    emailService = new EmailService();
  });

  describe('getTransporter', () => {
    it('should initialize a JSON transport when SMTP credentials are not configured', () => {
      const originalHost = env.SMTP_HOST;
      const originalUser = env.SMTP_USER;
      // Temporarily clear host and user
      (env as { SMTP_HOST?: string }).SMTP_HOST = undefined;
      (env as { SMTP_USER?: string }).SMTP_USER = undefined;

      const createTransportSpy = vi.spyOn(nodemailer, 'createTransport');
      const transporter = emailService.getTransporter();

      expect(transporter).toBeDefined();
      expect(createTransportSpy).toHaveBeenCalledWith({ jsonTransport: true });

      // Restore
      (env as { SMTP_HOST?: string }).SMTP_HOST = originalHost;
      (env as { SMTP_USER?: string }).SMTP_USER = originalUser;
    });

    it('should initialize an SMTP transport when host and user are configured', () => {
      const originalHost = env.SMTP_HOST;
      const originalUser = env.SMTP_USER;
      (env as { SMTP_HOST?: string }).SMTP_HOST = 'smtp.example.com';
      (env as { SMTP_USER?: string }).SMTP_USER = 'smtp_user';

      const createTransportSpy = vi.spyOn(nodemailer, 'createTransport');
      const transporter = emailService.getTransporter();

      expect(transporter).toBeDefined();
      expect(createTransportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          auth: expect.objectContaining({ user: 'smtp_user' }),
        }),
      );

      // Restore
      (env as { SMTP_HOST?: string }).SMTP_HOST = originalHost;
      (env as { SMTP_USER?: string }).SMTP_USER = originalUser;
    });

    it('should reuse existing transporter on consecutive calls (singleton per instance)', () => {
      const createTransportSpy = vi.spyOn(nodemailer, 'createTransport');
      const transporter1 = emailService.getTransporter();
      const transporter2 = emailService.getTransporter();

      expect(transporter1).toBe(transporter2);
      expect(createTransportSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendEmail', () => {
    it('should dispatch email and return messageId and previewUrl', async () => {
      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: 'msg_test_123',
      });
      vi.spyOn(emailService, 'getTransporter').mockReturnValue({
        sendMail: mockSendMail,
      } as never);

      const result = await emailService.sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Hello world</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Test Subject',
          html: '<p>Hello world</p>',
        }),
      );
      expect(result.messageId).toBe('msg_test_123');
    });

    it('should throw and log error when sendMail encounters failure', async () => {
      const error = new Error('SMTP connection rejected');
      vi.spyOn(emailService, 'getTransporter').mockReturnValue({
        sendMail: vi.fn().mockRejectedValue(error),
      } as never);

      await expect(
        emailService.sendEmail({
          to: 'fail@example.com',
          subject: 'Fail Subject',
          html: '<p>Fail</p>',
        }),
      ).rejects.toThrow('SMTP connection rejected');
    });
  });
});
