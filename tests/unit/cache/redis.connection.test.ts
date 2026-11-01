import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EventEmitter from 'events';

class MockRedisClient extends EventEmitter {
  public status: string = 'wait';
  public connect = vi.fn().mockImplementation(async () => {
    this.status = 'ready';
    this.emit('ready');
  });
  public quit = vi.fn().mockImplementation(async () => {
    this.status = 'end';
    this.emit('close');
  });
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

describe('Redis Connection', () => {
  beforeEach(() => {
    mockInstance = new MockRedisClient();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { disconnectRedis } = await import('../../../src/infrastructure/cache/redis/connection');
    await disconnectRedis();
    vi.resetModules();
  });

  it('should create and return a singleton Redis instance', async () => {
    const { getRedisClient } = await import('../../../src/infrastructure/cache/redis/connection');
    const client1 = getRedisClient();
    const client2 = getRedisClient();

    expect(client1).toBe(client2);
    expect(client1).toBe(mockInstance);
  });

  it('should establish connection when status is wait', async () => {
    const { connectRedis, isRedisConnected } =
      await import('../../../src/infrastructure/cache/redis/connection');

    expect(isRedisConnected()).toBe(false);
    await connectRedis();

    expect(mockInstance.connect).toHaveBeenCalledTimes(1);
    expect(isRedisConnected()).toBe(true);
  });

  it('should handle disconnect and reset internal state', async () => {
    const { connectRedis, disconnectRedis, isRedisConnected } =
      await import('../../../src/infrastructure/cache/redis/connection');

    await connectRedis();
    expect(isRedisConnected()).toBe(true);

    await disconnectRedis();
    expect(mockInstance.quit).toHaveBeenCalledTimes(1);
    expect(isRedisConnected()).toBe(false);
  });

  it('should update connection state on error and close events', async () => {
    const { connectRedis, isRedisConnected } =
      await import('../../../src/infrastructure/cache/redis/connection');

    await connectRedis();
    expect(isRedisConnected()).toBe(true);

    mockInstance.emit('error', new Error('Connection lost'));
    expect(isRedisConnected()).toBe(false);

    mockInstance.status = 'ready';
    mockInstance.emit('ready');
    expect(isRedisConnected()).toBe(true);

    mockInstance.emit('close');
    expect(isRedisConnected()).toBe(false);
  });

  it('should throw when connect fails', async () => {
    mockInstance.connect = vi.fn().mockRejectedValue(new Error('Redis connection refused'));
    const { connectRedis } = await import('../../../src/infrastructure/cache/redis/connection');

    await expect(connectRedis()).rejects.toThrow('Redis connection refused');
  });
});
