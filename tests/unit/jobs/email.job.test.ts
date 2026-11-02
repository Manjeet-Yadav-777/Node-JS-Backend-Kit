import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processEmailJob,
  enqueueWelcomeEmail,
  enqueuePasswordResetEmail,
  enqueueGenericEmail,
  startEmailWorker,
  EMAIL_QUEUE_NAME,
  EMAIL_JOB_NAMES,
  WelcomeEmailJobData,
  PasswordResetEmailJobData,
  GenericEmailJobData,
} from '../../../src/jobs';
import { queueManager, workerManager } from '../../../src/infrastructure';

vi.mock('../../../src/infrastructure', () => ({
  queueManager: {
    addJob: vi.fn(),
  },
  workerManager: {
    registerWorker: vi.fn(),
  },
}));

describe('EmailJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processEmailJob', () => {
    it('should process send-welcome email job successfully', async () => {
      const mockJob = {
        id: 'job_welcome_1',
        name: EMAIL_JOB_NAMES.SEND_WELCOME,
        data: {
          to: 'user@example.com',
          name: 'Jane Doe',
          userId: 'usr_123',
        } as WelcomeEmailJobData,
      };

      const result = await processEmailJob(mockJob as never);

      expect(result).toBeDefined();
      expect(result.messageId).toBe('msg_job_welcome_1');
      expect(result.sentAt).toBeDefined();
    });

    it('should process send-password-reset email job successfully', async () => {
      const mockJob = {
        id: 'job_reset_2',
        name: EMAIL_JOB_NAMES.SEND_PASSWORD_RESET,
        data: {
          to: 'user@example.com',
          resetToken: 'xyz789token',
          expiresInMinutes: 15,
        } as PasswordResetEmailJobData,
      };

      const result = await processEmailJob(mockJob as never);

      expect(result).toBeDefined();
      expect(result.messageId).toBe('msg_job_reset_2');
      expect(result.sentAt).toBeDefined();
    });

    it('should process send-generic email job successfully', async () => {
      const mockJob = {
        id: 'job_generic_3',
        name: EMAIL_JOB_NAMES.SEND_GENERIC,
        data: {
          to: 'admin@example.com',
          subject: 'Weekly Digest',
          content: 'Here is your weekly summary...',
        } as GenericEmailJobData,
      };

      const result = await processEmailJob(mockJob as never);

      expect(result).toBeDefined();
      expect(result.messageId).toBe('msg_job_generic_3');
      expect(result.sentAt).toBeDefined();
    });

    it('should handle fallback messageId when job id is undefined', async () => {
      const mockJob = {
        id: undefined,
        name: EMAIL_JOB_NAMES.SEND_WELCOME,
        data: {
          to: 'user@example.com',
          name: 'Jane',
          userId: 'usr_456',
        } as WelcomeEmailJobData,
      };

      const result = await processEmailJob(mockJob as never);

      expect(result.messageId).toMatch(/^msg_\d+$/);
    });

    it('should handle unknown job names without throwing', async () => {
      const mockJob = {
        id: 'job_unknown',
        name: 'send-unsupported-type',
        data: {
          to: 'test@example.com',
          name: 'Test',
          userId: '1',
        } as WelcomeEmailJobData,
      };

      const result = await processEmailJob(mockJob as never);

      expect(result.messageId).toBe('msg_job_unknown');
    });
  });

  describe('enqueueWelcomeEmail', () => {
    it('should delegate to queueManager.addJob with correct queue and job name', async () => {
      const payload: WelcomeEmailJobData = {
        to: 'newuser@example.com',
        name: 'New User',
        userId: 'usr_789',
      };
      const mockJob = { id: 'job_100', data: payload };
      vi.mocked(queueManager.addJob).mockResolvedValue(mockJob as never);

      const result = await enqueueWelcomeEmail(payload, { priority: 1 });

      expect(result).toBe(mockJob);
      expect(queueManager.addJob).toHaveBeenCalledWith(
        EMAIL_QUEUE_NAME,
        EMAIL_JOB_NAMES.SEND_WELCOME,
        payload,
        { priority: 1 },
      );
    });
  });

  describe('enqueuePasswordResetEmail', () => {
    it('should delegate to queueManager.addJob with reset payload', async () => {
      const payload: PasswordResetEmailJobData = {
        to: 'reset@example.com',
        resetToken: 'token_abc',
        expiresInMinutes: 30,
      };
      const mockJob = { id: 'job_101', data: payload };
      vi.mocked(queueManager.addJob).mockResolvedValue(mockJob as never);

      const result = await enqueuePasswordResetEmail(payload);

      expect(result).toBe(mockJob);
      expect(queueManager.addJob).toHaveBeenCalledWith(
        EMAIL_QUEUE_NAME,
        EMAIL_JOB_NAMES.SEND_PASSWORD_RESET,
        payload,
        undefined,
      );
    });
  });

  describe('enqueueGenericEmail', () => {
    it('should delegate to queueManager.addJob with generic email payload', async () => {
      const payload: GenericEmailJobData = {
        to: 'subscriber@example.com',
        subject: 'Monthly Newsletter',
        content: 'Newsletter content',
      };
      const mockJob = { id: 'job_102', data: payload };
      vi.mocked(queueManager.addJob).mockResolvedValue(mockJob as never);

      const result = await enqueueGenericEmail(payload, { delay: 5000 });

      expect(result).toBe(mockJob);
      expect(queueManager.addJob).toHaveBeenCalledWith(
        EMAIL_QUEUE_NAME,
        EMAIL_JOB_NAMES.SEND_GENERIC,
        payload,
        { delay: 5000 },
      );
    });
  });

  describe('startEmailWorker', () => {
    it('should register a worker for the email queue with default concurrency', () => {
      const mockWorker = { id: 'worker_email' };
      vi.mocked(workerManager.registerWorker).mockReturnValue(mockWorker as never);

      const worker = startEmailWorker();

      expect(worker).toBe(mockWorker);
      expect(workerManager.registerWorker).toHaveBeenCalledWith(EMAIL_QUEUE_NAME, processEmailJob, {
        concurrency: 5,
      });
    });

    it('should allow custom concurrency when starting email worker', () => {
      const mockWorker = { id: 'worker_email_custom' };
      vi.mocked(workerManager.registerWorker).mockReturnValue(mockWorker as never);

      startEmailWorker(10);

      expect(workerManager.registerWorker).toHaveBeenCalledWith(EMAIL_QUEUE_NAME, processEmailJob, {
        concurrency: 10,
      });
    });
  });
});
