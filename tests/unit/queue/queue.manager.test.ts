import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueManager } from '../../../src/infrastructure';

const { MockQueue } = vi.hoisted(() => {
  class MockQueue {
    public name: string;
    public add = vi.fn();
    public addBulk = vi.fn();
    public close = vi.fn().mockResolvedValue(undefined);

    constructor(name: string) {
      this.name = name;
    }
  }
  return { MockQueue };
});

vi.mock('bullmq', () => ({
  Queue: MockQueue,
}));

vi.mock('../../../src/infrastructure/queue/bullmq/connection', () => ({
  createBullMQConnection: vi.fn().mockReturnValue({}),
}));

describe('QueueManager', () => {
  let queueManager: QueueManager;

  beforeEach(() => {
    queueManager = new QueueManager();
    vi.clearAllMocks();
  });

  describe('getQueue', () => {
    it('should create and cache Queue instances per queue name', () => {
      const queue1 = queueManager.getQueue('email-queue');
      const queue2 = queueManager.getQueue('email-queue');

      expect(queue1).toBe(queue2);
      expect(queue1.name).toBe('email-queue');
    });

    it('should create distinct queues for different queue names', () => {
      const emailQueue = queueManager.getQueue('email-queue');
      const reportQueue = queueManager.getQueue('report-queue');

      expect(emailQueue).not.toBe(reportQueue);
      expect(emailQueue.name).toBe('email-queue');
      expect(reportQueue.name).toBe('report-queue');
    });
  });

  describe('addJob', () => {
    it('should add a job with default exponential backoff retry options', async () => {
      const queue = queueManager.getQueue('notifications');
      const mockJob = { id: 'job_123', name: 'send_sms', data: { phone: '1234567890' } };
      vi.mocked(queue.add).mockResolvedValue(mockJob as never);

      const job = await queueManager.addJob('notifications', 'send_sms', {
        phone: '1234567890',
      });

      expect(job).toEqual(mockJob);
      expect(queue.add).toHaveBeenCalledWith(
        'send_sms',
        { phone: '1234567890' },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        }),
      );
    });

    it('should allow overriding default options with custom delay and priority', async () => {
      const queue = queueManager.getQueue('delayed-tasks');
      const mockJob = { id: 'job_456' };
      vi.mocked(queue.add).mockResolvedValue(mockJob as never);

      await queueManager.addJob(
        'delayed-tasks',
        'delayed_cleanup',
        { task: 'purge' },
        { delay: 5000, priority: 1, attempts: 5 },
      );

      expect(queue.add).toHaveBeenCalledWith(
        'delayed_cleanup',
        { task: 'purge' },
        expect.objectContaining({
          delay: 5000,
          priority: 1,
          attempts: 5,
        }),
      );
    });

    it('should throw error when adding job fails', async () => {
      const queue = queueManager.getQueue('failing-queue');
      vi.mocked(queue.add).mockRejectedValue(new Error('Redis full'));

      await expect(queueManager.addJob('failing-queue', 'job', { data: 1 })).rejects.toThrow(
        'Redis full',
      );
    });
  });

  describe('addBulkJobs', () => {
    it('should batch add multiple jobs with default options applied', async () => {
      const queue = queueManager.getQueue('bulk-queue');
      const mockJobs = [{ id: '1' }, { id: '2' }];
      vi.mocked(queue.addBulk).mockResolvedValue(mockJobs as never);

      const jobsToAdd = [
        { name: 'send_email', data: { to: 'a@test.com' } },
        { name: 'send_email', data: { to: 'b@test.com' }, opts: { delay: 2000 } },
      ];

      const result = await queueManager.addBulkJobs('bulk-queue', jobsToAdd);

      expect(result).toEqual(mockJobs);
      expect(queue.addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'send_email',
          data: { to: 'a@test.com' },
          opts: expect.objectContaining({ attempts: 3 }),
        }),
        expect.objectContaining({
          name: 'send_email',
          data: { to: 'b@test.com' },
          opts: expect.objectContaining({ delay: 2000, attempts: 3 }),
        }),
      ]);
    });

    it('should throw when bulk addition fails', async () => {
      const queue = queueManager.getQueue('bulk-queue');
      vi.mocked(queue.addBulk).mockRejectedValue(new Error('Bulk failed'));

      await expect(
        queueManager.addBulkJobs('bulk-queue', [{ name: 'job1', data: {} }]),
      ).rejects.toThrow('Bulk failed');
    });
  });

  describe('closeAll', () => {
    it('should close all registered queues and clear registry', async () => {
      const q1 = queueManager.getQueue('q1');
      const q2 = queueManager.getQueue('q2');

      await queueManager.closeAll();

      expect(q1.close).toHaveBeenCalledTimes(1);
      expect(q2.close).toHaveBeenCalledTimes(1);
    });

    it('should handle errors gracefully during closeAll', async () => {
      const q = queueManager.getQueue('error-q');
      vi.mocked(q.close).mockRejectedValue(new Error('Close error'));

      await expect(queueManager.closeAll()).resolves.not.toThrow();
    });
  });
});
