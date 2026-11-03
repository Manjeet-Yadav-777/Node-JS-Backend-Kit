import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KafkaProducer } from '../../../../src/infrastructure/kafka/producer';
import * as kafkaConnection from '../../../../src/infrastructure/kafka/connection';

describe('KafkaProducer', () => {
  let mockProducer: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    events: {
      CONNECT: string;
      DISCONNECT: string;
    };
  };

  let mockClient: {
    producer: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockProducer = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue([
        {
          topicName: 'test-topic',
          partition: 0,
          errorCode: 0,
          offset: '1',
        },
      ]),
      on: vi.fn(),
      events: {
        CONNECT: 'producer.connect',
        DISCONNECT: 'producer.disconnect',
      },
    };

    mockClient = {
      producer: vi.fn().mockReturnValue(mockProducer),
    };

    vi.spyOn(kafkaConnection, 'isKafkaConfigured').mockReturnValue(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(kafkaConnection, 'getKafkaClient').mockReturnValue(mockClient as any);
  });

  it('should lazily connect and publish a single event with JSON serialization', async () => {
    const producer = new KafkaProducer();

    const result = await producer.publish({
      topic: 'user-registered',
      key: 'user-123',
      value: { id: 'user-123', email: 'test@example.com' },
      headers: { source: 'api' },
    });

    expect(mockProducer.connect).toHaveBeenCalledTimes(1);
    expect(mockProducer.send).toHaveBeenCalledTimes(1);
    expect(mockProducer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'user-registered',
        messages: [
          expect.objectContaining({
            key: 'user-123',
            value: JSON.stringify({ id: 'user-123', email: 'test@example.com' }),
            headers: { source: 'api' },
          }),
        ],
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.topicName).toBe('test-topic');
  });

  it('should publish a batch of events', async () => {
    const producer = new KafkaProducer();

    const events = [
      { key: 'key-1', value: { item: 1 } },
      { key: 'key-2', value: { item: 2 } },
    ];

    const result = await producer.publishBatch('batch-topic', events);

    expect(mockProducer.connect).toHaveBeenCalledTimes(1);
    expect(mockProducer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'batch-topic',
        messages: expect.arrayContaining([
          expect.objectContaining({
            key: 'key-1',
            value: JSON.stringify({ item: 1 }),
          }),
          expect.objectContaining({
            key: 'key-2',
            value: JSON.stringify({ item: 2 }),
          }),
        ]),
      }),
    );
    expect(result).toBeDefined();
  });

  it('should skip publishing if Kafka is not configured in the environment', async () => {
    vi.spyOn(kafkaConnection, 'isKafkaConfigured').mockReturnValue(false);

    const producer = new KafkaProducer();
    const result = await producer.publish({
      topic: 'unconfigured-topic',
      value: { test: true },
    });

    expect(mockProducer.connect).not.toHaveBeenCalled();
    expect(mockProducer.send).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('should gracefully handle disconnect', async () => {
    const producer = new KafkaProducer();
    await producer.connect();

    await producer.disconnect();

    expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
    expect(producer.getIsConnected()).toBe(false);
  });

  it('should handle raw string or Buffer values without double stringifying', async () => {
    const producer = new KafkaProducer();

    await producer.publish({
      topic: 'raw-topic',
      value: 'raw string message',
    });

    expect(mockProducer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            value: 'raw string message',
          }),
        ],
      }),
    );

    const bufferVal = Buffer.from('buffer message');
    await producer.publish({
      topic: 'buffer-topic',
      value: bufferVal,
    });

    expect(mockProducer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            value: bufferVal,
          }),
        ],
      }),
    );
  });
});
