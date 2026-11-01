import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { CacheService } from '../../../src/infrastructure';

const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  scanStream: vi.fn(),
};

vi.mock('../../../src/infrastructure/cache/redis/connection', () => ({
  getRedisClient: () => mockRedisClient,
}));

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService();
    vi.clearAllMocks();
  });

  describe('get', () => {
    it('should return parsed data when key exists', async () => {
      const payload = { id: 'user_1', name: 'John Doe', role: 'admin' };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(payload));

      const result = await cacheService.get<typeof payload>('user:1');

      expect(mockRedisClient.get).toHaveBeenCalledWith('user:1');
      expect(result).toEqual(payload);
    });

    it('should return null when key is missing in Redis', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.get('user:non_existent');

      expect(result).toBeNull();
    });

    it('should fail open and return null if Redis throws an error', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection timeout'));

      const result = await cacheService.get('user:error');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should serialize and set key without TTL when TTL is not provided', async () => {
      const payload = { theme: 'dark', notifications: true };
      mockRedisClient.set.mockResolvedValue('OK');

      await cacheService.set('settings:1', payload);

      expect(mockRedisClient.set).toHaveBeenCalledWith('settings:1', JSON.stringify(payload));
    });

    it('should set key with TTL EX when ttlSeconds is provided', async () => {
      const payload = { token: 'sample_token' };
      mockRedisClient.set.mockResolvedValue('OK');

      await cacheService.set('session:1', payload, 300);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'session:1',
        JSON.stringify(payload),
        'EX',
        300,
      );
    });

    it('should not throw if Redis fails during set (fail-open resilience)', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis write failed'));

      await expect(cacheService.set('key', { test: true })).resolves.not.toThrow();
    });
  });

  describe('del', () => {
    it('should delete a single key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.del('user:1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('user:1');
    });

    it('should delete multiple keys when array is provided', async () => {
      mockRedisClient.del.mockResolvedValue(2);

      await cacheService.del(['user:1', 'user:2']);

      expect(mockRedisClient.del).toHaveBeenCalledWith('user:1', 'user:2');
    });

    it('should do nothing when an empty array of keys is passed', async () => {
      await cacheService.del([]);

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should not throw if Redis fails during del', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis del failed'));

      await expect(cacheService.del('key')).resolves.not.toThrow();
    });
  });

  describe('has', () => {
    it('should return true when key exists in Redis', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const exists = await cacheService.has('active:user:1');

      expect(exists).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('active:user:1');
    });

    it('should return false when key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const exists = await cacheService.has('missing:key');

      expect(exists).toBe(false);
    });

    it('should return false if Redis throws an error', async () => {
      mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

      const exists = await cacheService.has('error:key');

      expect(exists).toBe(false);
    });
  });

  describe('remember', () => {
    it('should return cached value and skip factory execution when key exists', async () => {
      const cachedData = { id: 'cache_hit', count: 100 };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const factory = vi.fn().mockResolvedValue({ id: 'fresh', count: 200 });
      const result = await cacheService.remember('stats:1', 60, factory);

      expect(result).toEqual(cachedData);
      expect(factory).not.toHaveBeenCalled();
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('should execute factory, cache result, and return fresh value on cache miss', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const freshData = { id: 'fresh_calc', result: 42 };
      const factory = vi.fn().mockResolvedValue(freshData);

      const result = await cacheService.remember('calc:42', 120, factory);

      expect(result).toEqual(freshData);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'calc:42',
        JSON.stringify(freshData),
        'EX',
        120,
      );
    });
  });

  describe('deleteByPattern', () => {
    it('should scan and delete matching keys', async () => {
      const mockStream = Readable.from([['users:temp:1', 'users:temp:2'], ['users:temp:3']]);
      mockRedisClient.scanStream.mockReturnValue(mockStream);
      mockRedisClient.del.mockResolvedValue(3);

      await cacheService.deleteByPattern('users:temp:*');

      expect(mockRedisClient.scanStream).toHaveBeenCalledWith({
        match: 'users:temp:*',
        count: 100,
      });
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        'users:temp:1',
        'users:temp:2',
        'users:temp:3',
      );
    });

    it('should not call del if no matching keys are found', async () => {
      const mockStream = Readable.from([[]]);
      mockRedisClient.scanStream.mockReturnValue(mockStream);

      await cacheService.deleteByPattern('nonexistent:*');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should not throw if pattern deletion encounters an error', async () => {
      mockRedisClient.scanStream.mockImplementation(() => {
        throw new Error('Stream failure');
      });

      await expect(cacheService.deleteByPattern('error:*')).resolves.not.toThrow();
    });
  });
});
