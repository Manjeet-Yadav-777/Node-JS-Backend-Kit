import { describe, it, expect, vi, beforeEach } from 'vitest';
import EventEmitter from 'events';
import {
  getBullMQConnectionOptions,
  createBullMQConnection,
  closeAllBullMQConnections,
} from '../../../src/infrastructure';

class MockRedisClient extends EventEmitter {
  public status = 'ready';
  public quit = vi.fn().mockResolvedValue('OK');
}

let mockInstance: MockRedisClient;

vi.mock('ioredis', () => {
  const MockClass = vi.fn().mockImplementation(function () {
    return mockInstance;
  });
  return {
    default: MockClass,
    Redis: MockClass,
  };
});

describe('BullMQ Connection Manager', () => {
  beforeEach(() => {
    mockInstance = new MockRedisClient();
    vi.clearAllMocks();
  });

  describe('getBullMQConnectionOptions', () => {
    it('should return options with maxRetriesPerRequest set to null and enableReadyCheck false', () => {
      const options = getBullMQConnectionOptions();

      expect(options.maxRetriesPerRequest).toBeNull();
      expect(options.enableReadyCheck).toBe(false);
      expect(typeof options.retryStrategy).toBe('function');
    });

    it('should calculate exponential retry delay capped at 3000ms', () => {
      const options = getBullMQConnectionOptions();
      const retryStrategy = options.retryStrategy!;

      expect(retryStrategy(1)).toBe(100);
      expect(retryStrategy(5)).toBe(500);
      expect(retryStrategy(50)).toBe(3000);
    });
  });

  describe('createBullMQConnection', () => {
    it('should instantiate a new Redis client and attach error handler', () => {
      const client = createBullMQConnection();

      expect(client).toBe(mockInstance);
      expect(mockInstance.listenerCount('error')).toBeGreaterThan(0);
    });

    it('should handle error event without crashing', () => {
      createBullMQConnection();

      expect(() => {
        mockInstance.emit('error', new Error('Simulated BullMQ Redis error'));
      }).not.toThrow();
    });
  });

  describe('closeAllBullMQConnections', () => {
    it('should quit all active connections and reset internal state', async () => {
      createBullMQConnection();
      createBullMQConnection();

      await closeAllBullMQConnections();

      expect(mockInstance.quit).toHaveBeenCalledTimes(2);
    });

    it('should not throw if a connection fails to quit', async () => {
      createBullMQConnection();
      mockInstance.quit = vi.fn().mockRejectedValue(new Error('Quit failed'));

      await expect(closeAllBullMQConnections()).resolves.not.toThrow();
    });
  });
});
