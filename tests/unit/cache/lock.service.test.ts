import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LockService } from '../../../src/infrastructure';
import { ConflictError } from '../../../src/core';

const mockRedisClient = {
  set: vi.fn(),
  eval: vi.fn(),
};

vi.mock('../../../src/infrastructure/cache/redis/connection', () => ({
  getRedisClient: () => mockRedisClient,
}));

describe('LockService', () => {
  let lockService: LockService;

  beforeEach(() => {
    lockService = new LockService();
    vi.clearAllMocks();
  });

  describe('acquire', () => {
    it('should acquire lock and return unique token when key is free', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      const token = await lockService.acquire('order:123', 3000);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:order:123',
        expect.any(String),
        'PX',
        3000,
        'NX',
      );
      expect(typeof token).toBe('string');
      expect(token?.length).toBeGreaterThan(10);
    });

    it('should not double-prefix key if lock: prefix is already provided', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await lockService.acquire('lock:invoice:456');

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:invoice:456',
        expect.any(String),
        'PX',
        5000,
        'NX',
      );
    });

    it('should return null when lock is already held by another process', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const token = await lockService.acquire('order:123');

      expect(token).toBeNull();
    });

    it('should return null and handle Redis error gracefully', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis connection failure'));

      const token = await lockService.acquire('order:error');

      expect(token).toBeNull();
    });
  });

  describe('release', () => {
    it('should execute atomic Lua script and return true on successful release', async () => {
      mockRedisClient.eval.mockResolvedValue(1);

      const released = await lockService.release('order:123', 'token-abc');

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("get", KEYS[1]) == ARGV[1]'),
        1,
        'lock:order:123',
        'token-abc',
      );
      expect(released).toBe(true);
    });

    it('should return false when lock token does not match (already expired or stolen)', async () => {
      mockRedisClient.eval.mockResolvedValue(0);

      const released = await lockService.release('order:123', 'wrong-token');

      expect(released).toBe(false);
    });

    it('should return false if Redis eval throws an error', async () => {
      mockRedisClient.eval.mockRejectedValue(new Error('Redis script error'));

      const released = await lockService.release('order:123', 'token-abc');

      expect(released).toBe(false);
    });
  });

  describe('withLock', () => {
    it('should execute task within lock and release lock in finally block', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      const task = vi.fn().mockResolvedValue('task_result');
      const result = await lockService.withLock('payment:999', task, { ttlMs: 4000 });

      expect(result).toBe('task_result');
      expect(task).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'lock:payment:999',
        expect.any(String),
        'PX',
        4000,
        'NX',
      );
      expect(mockRedisClient.eval).toHaveBeenCalledTimes(1);
    });

    it('should release lock even when the task throws an error', async () => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      const task = vi.fn().mockRejectedValue(new Error('Processing failed'));

      await expect(lockService.withLock('order:fail', task)).rejects.toThrow('Processing failed');
      expect(mockRedisClient.eval).toHaveBeenCalledTimes(1);
    });

    it('should retry acquiring lock and succeed if acquired within retry limit', async () => {
      mockRedisClient.set.mockResolvedValueOnce(null).mockResolvedValueOnce('OK');
      mockRedisClient.eval.mockResolvedValue(1);

      const task = vi.fn().mockResolvedValue('retry_success');
      const result = await lockService.withLock('job:cron', task, {
        retries: 2,
        retryDelayMs: 10,
      });

      expect(result).toBe('retry_success');
      expect(mockRedisClient.set).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.eval).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictError if lock cannot be acquired after all retries', async () => {
      mockRedisClient.set.mockResolvedValue(null);

      const task = vi.fn();

      await expect(
        lockService.withLock('busy:resource', task, { retries: 2, retryDelayMs: 10 }),
      ).rejects.toThrow(ConflictError);

      expect(task).not.toHaveBeenCalled();
      expect(mockRedisClient.eval).not.toHaveBeenCalled();
    });
  });
});
