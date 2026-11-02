import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerManager } from '../../../src/infrastructure';

const { MockWorker } = vi.hoisted(() => {
  class MockWorker {
    public name: string;
    public processor: unknown;
    public opts: unknown;
    public listeners = new Map<string, (...args: unknown[]) => void>();
    public close = vi.fn().mockResolvedValue(undefined);

    constructor(name: string, processor: unknown, opts: unknown) {
      this.name = name;
      this.processor = processor;
      this.opts = opts;
    }

    public on = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      this.listeners.set(event, callback);
      return this;
    });
  }
  return { MockWorker };
});

vi.mock('bullmq', () => ({
  Worker: MockWorker,
}));

vi.mock('../../../src/infrastructure/queue/bullmq/connection', () => ({
  createBullMQConnection: vi.fn().mockReturnValue({}),
}));

describe('WorkerManager', () => {
  let workerManager: WorkerManager;

  beforeEach(() => {
    workerManager = new WorkerManager();
    vi.clearAllMocks();
  });

  describe('registerWorker', () => {
    it('should register a worker with default concurrency of 5 and dedicated connection', () => {
      const processor = vi.fn().mockResolvedValue({ processed: true });
      const worker = workerManager.registerWorker('email-queue', processor);

      expect(worker).toBeDefined();
      expect(worker.name).toBe('email-queue');
      expect((worker as unknown as { opts: { concurrency: number } }).opts.concurrency).toBe(5);
      expect(worker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(worker.on).toHaveBeenCalledWith('stalled', expect.any(Function));
    });

    it('should allow overriding concurrency and passing custom worker options', () => {
      const processor = vi.fn();
      const worker = workerManager.registerWorker('image-processing', processor, {
        concurrency: 10,
        lockDuration: 60000,
      });

      expect(
        (worker as unknown as { opts: { concurrency: number; lockDuration: number } }).opts
          .concurrency,
      ).toBe(10);
      expect(
        (worker as unknown as { opts: { concurrency: number; lockDuration: number } }).opts
          .lockDuration,
      ).toBe(60000);
    });

    it('should trigger registered event listener callbacks without throwing', () => {
      const processor = vi.fn();
      const worker = workerManager.registerWorker('events-queue', processor) as unknown as {
        listeners: Map<string, (...args: unknown[]) => void>;
      };

      const completedCallback = worker.listeners.get('completed');
      const failedCallback = worker.listeners.get('failed');
      const errorCallback = worker.listeners.get('error');
      const stalledCallback = worker.listeners.get('stalled');

      expect(() => {
        completedCallback?.({ id: 'job_1', name: 'send' }, { ok: true }, 'active');
        failedCallback?.(
          { id: 'job_2', name: 'send', attemptsMade: 1 },
          new Error('Boom'),
          'active',
        );
        failedCallback?.(undefined, new Error('Orphan fail'), 'active');
        errorCallback?.(new Error('Connection dropped'));
        stalledCallback?.('job_3', 'active');
      }).not.toThrow();
    });

    it('should throw an error when registering a worker for an already registered queue', () => {
      const processor = vi.fn();
      workerManager.registerWorker('duplicate-queue', processor);

      expect(() => {
        workerManager.registerWorker('duplicate-queue', processor);
      }).toThrow('Worker for queue "duplicate-queue" is already registered');
    });
  });

  describe('getWorker', () => {
    it('should return the registered worker for an existing queue', () => {
      const processor = vi.fn();
      const registered = workerManager.registerWorker('test-queue', processor);
      const retrieved = workerManager.getWorker('test-queue');

      expect(retrieved).toBe(registered);
    });

    it('should return undefined when no worker is registered for queue', () => {
      const worker = workerManager.getWorker('non-existent-queue');
      expect(worker).toBeUndefined();
    });
  });

  describe('closeWorker', () => {
    it('should close the worker and remove it from registry', async () => {
      const processor = vi.fn();
      const worker = workerManager.registerWorker('close-queue', processor);

      await workerManager.closeWorker('close-queue');

      expect(worker.close).toHaveBeenCalledTimes(1);
      expect(workerManager.getWorker('close-queue')).toBeUndefined();
    });

    it('should do nothing if closing a non-existent worker', async () => {
      await expect(workerManager.closeWorker('unknown-queue')).resolves.not.toThrow();
    });

    it('should propagate error if worker close throws', async () => {
      const processor = vi.fn();
      const worker = workerManager.registerWorker('err-queue', processor);
      vi.mocked(worker.close).mockRejectedValueOnce(new Error('Close failure'));

      await expect(workerManager.closeWorker('err-queue')).rejects.toThrow('Close failure');
    });
  });

  describe('closeAll', () => {
    it('should close all registered workers and clear the map', async () => {
      const p = vi.fn();
      const w1 = workerManager.registerWorker('q1', p);
      const w2 = workerManager.registerWorker('q2', p);

      await workerManager.closeAll();

      expect(w1.close).toHaveBeenCalledTimes(1);
      expect(w2.close).toHaveBeenCalledTimes(1);
      expect(workerManager.getWorker('q1')).toBeUndefined();
      expect(workerManager.getWorker('q2')).toBeUndefined();
    });

    it('should gracefully handle close errors during closeAll without throwing', async () => {
      const p = vi.fn();
      const w = workerManager.registerWorker('faulty-queue', p);
      vi.mocked(w.close).mockRejectedValueOnce(new Error('Shutdown error'));

      await expect(workerManager.closeAll()).resolves.not.toThrow();
    });
  });
});
