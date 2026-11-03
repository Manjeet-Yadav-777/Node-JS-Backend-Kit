import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KafkaConsumerManager } from '../../../../src/infrastructure/kafka/consumer';
import * as kafkaConnection from '../../../../src/infrastructure/kafka/connection';
import { EachMessagePayload } from 'kafkajs';

describe('KafkaConsumerManager', () => {
  let mockConsumer: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  };

  let mockClient: {
    consumer: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockConsumer = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockResolvedValue(undefined),
      run: vi.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      consumer: vi.fn().mockReturnValue(mockConsumer),
    };

    vi.spyOn(kafkaConnection, 'isKafkaConfigured').mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(kafkaConnection, 'getKafkaClient').mockReturnValue(mockClient as any);
  });

  it('should register a consumer, connect, subscribe to topics, and invoke handler on message', async () => {
    const manager = new KafkaConsumerManager();
    const handler = vi.fn().mockResolvedValue(undefined);

    const consumer = await manager.registerConsumer({
      groupId: 'test-group',
      topics: ['user-events', 'audit-events'],
      fromBeginning: true,
      handler,
    });

    expect(consumer).toBeDefined();
    expect(mockClient.consumer).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 'test-group' }),
    );
    expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
    expect(mockConsumer.subscribe).toHaveBeenCalledWith({
      topic: 'user-events',
      fromBeginning: true,
    });
    expect(mockConsumer.subscribe).toHaveBeenCalledWith({
      topic: 'audit-events',
      fromBeginning: true,
    });
    expect(mockConsumer.run).toHaveBeenCalledTimes(1);
    expect(manager.getActiveConsumerCount()).toBe(1);

    // Simulate incoming Kafka message
    const runCall = mockConsumer.run.mock.calls[0]?.[0] as {
      eachMessage: (payload: EachMessagePayload) => Promise<void>;
    };
    expect(runCall).toBeDefined();

    const mockPayload: EachMessagePayload = {
      topic: 'user-events',
      partition: 2,
      message: {
        key: Buffer.from('user-99'),
        value: Buffer.from(JSON.stringify({ event: 'signed-up', email: 'test@example.com' })),
        headers: {
          traceId: Buffer.from('trace-123'),
          client: 'mobile-app',
        },
        offset: '105',
        timestamp: '1700000000000',
        attributes: 0,
      },
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(() => {}),
    };

    await runCall.eachMessage(mockPayload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'user-events',
        partition: 2,
        offset: '105',
        key: 'user-99',
        value: { event: 'signed-up', email: 'test@example.com' },
        headers: {
          traceId: 'trace-123',
          client: 'mobile-app',
        },
      }),
      mockPayload,
    );
  });

  it('should handle raw string messages gracefully when JSON parsing fails', async () => {
    const manager = new KafkaConsumerManager();
    const handler = vi.fn().mockResolvedValue(undefined);

    await manager.registerConsumer({
      groupId: 'raw-group',
      topics: ['raw-topic'],
      handler,
    });

    const runCall = mockConsumer.run.mock.calls[0]?.[0] as {
      eachMessage: (payload: EachMessagePayload) => Promise<void>;
    };

    const mockPayload: EachMessagePayload = {
      topic: 'raw-topic',
      partition: 0,
      message: {
        key: null,
        value: Buffer.from('plain non-json text'),
        headers: {},
        offset: '1',
        timestamp: '1700000000000',
        attributes: 0,
      },
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(() => {}),
    };

    await runCall.eachMessage(mockPayload);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 'plain non-json text',
        key: null,
      }),
      mockPayload,
    );
  });

  it('should rethrow errors thrown by message handler', async () => {
    const manager = new KafkaConsumerManager();
    const handler = vi.fn().mockRejectedValue(new Error('Handler processing failed'));

    await manager.registerConsumer({
      groupId: 'error-group',
      topics: ['error-topic'],
      handler,
    });

    const runCall = mockConsumer.run.mock.calls[0]?.[0] as {
      eachMessage: (payload: EachMessagePayload) => Promise<void>;
    };

    const mockPayload: EachMessagePayload = {
      topic: 'error-topic',
      partition: 0,
      message: {
        key: null,
        value: null,
        headers: undefined,
        offset: '1',
        timestamp: '1700000000000',
        attributes: 0,
      },
      heartbeat: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockReturnValue(() => {}),
    };

    await expect(runCall.eachMessage(mockPayload)).rejects.toThrow('Handler processing failed');
  });

  it('should return existing consumer if group is already registered', async () => {
    const manager = new KafkaConsumerManager();
    const handler = vi.fn();

    const consumer1 = await manager.registerConsumer({
      groupId: 'duplicate-group',
      topics: ['topic-1'],
      handler,
    });

    const consumer2 = await manager.registerConsumer({
      groupId: 'duplicate-group',
      topics: ['topic-2'],
      handler,
    });

    expect(consumer1).toBe(consumer2);
    expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
  });

  it('should return null and skip registration if Kafka is not configured', async () => {
    vi.spyOn(kafkaConnection, 'isKafkaConfigured').mockReturnValue(false);

    const manager = new KafkaConsumerManager();
    const handler = vi.fn();

    const consumer = await manager.registerConsumer({
      groupId: 'unconfigured-group',
      topics: ['topic-1'],
      handler,
    });

    expect(consumer).toBeNull();
    expect(mockConsumer.connect).not.toHaveBeenCalled();
  });

  it('should disconnect specific consumer and close all consumers', async () => {
    const manager = new KafkaConsumerManager();

    await manager.registerConsumer({
      groupId: 'group-1',
      topics: ['topic-1'],
      handler: vi.fn(),
    });

    expect(manager.getConsumer('group-1')).toBeDefined();
    await manager.disconnectConsumer('group-1');
    expect(manager.getConsumer('group-1')).toBeUndefined();
    expect(mockConsumer.disconnect).toHaveBeenCalledTimes(1);

    await manager.registerConsumer({
      groupId: 'group-2',
      topics: ['topic-2'],
      handler: vi.fn(),
    });

    await manager.closeAll();
    expect(manager.getActiveConsumerCount()).toBe(0);
  });
});
