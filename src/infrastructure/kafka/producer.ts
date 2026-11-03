import { Producer, ProducerConfig, RecordMetadata, Message, CompressionTypes } from 'kafkajs';
import { getKafkaClient, isKafkaConfigured } from './connection';
import { logger } from '../../config';

export interface KafkaEvent<T = unknown> {
  topic: string;
  key?: string;
  value: T;
  headers?: Record<string, string>;
  partition?: number;
}

export interface PublishOptions {
  acks?: number;
  timeout?: number;
  compression?: CompressionTypes;
}

export class KafkaProducer {
  private producer: Producer | null = null;
  private isConnected = false;
  private isConnecting = false;

  constructor(private readonly config?: ProducerConfig) {}

  /**
   * Initializes and connects the underlying KafkaJS Producer instance lazily.
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (!isKafkaConfigured()) {
      logger.warn('[KafkaProducer] Kafka brokers not configured; skipping producer connection');
      return;
    }

    if (this.isConnecting) {
      while (this.isConnecting) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return;
    }

    this.isConnecting = true;
    try {
      if (!this.producer) {
        const client = getKafkaClient();
        this.producer = client.producer({
          allowAutoTopicCreation: true,
          ...this.config,
        });

        this.producer.on(this.producer.events.CONNECT, () => {
          this.isConnected = true;
          logger.info('[KafkaProducer] Producer connected to Kafka cluster');
        });

        this.producer.on(this.producer.events.DISCONNECT, () => {
          this.isConnected = false;
          logger.warn('[KafkaProducer] Producer disconnected from Kafka cluster');
        });
      }

      await this.producer.connect();
      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;
      logger.error({ error }, '[KafkaProducer] Failed to connect producer to Kafka cluster');
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Serializes arbitrary payload values into string or Buffer for Kafka transmission.
   */
  private serializeValue<T>(value: T): string | Buffer {
    if (Buffer.isBuffer(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value;
    }
    return JSON.stringify(value);
  }

  /**
   * Publishes a single strongly typed event to a Kafka topic.
   */
  public async publish<T = unknown>(
    event: KafkaEvent<T>,
    options?: PublishOptions,
  ): Promise<RecordMetadata[]> {
    if (!isKafkaConfigured()) {
      logger.warn(
        { topic: event.topic },
        '[KafkaProducer] Kafka not configured; event publication skipped',
      );
      return [];
    }

    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.producer) {
      throw new Error('[KafkaProducer] Producer is not initialized');
    }

    const message: Message = {
      key: event.key,
      value: this.serializeValue(event.value),
      headers: event.headers,
      partition: event.partition,
      timestamp: Date.now().toString(),
    };

    try {
      const metadata = await this.producer.send({
        topic: event.topic,
        messages: [message],
        acks: options?.acks,
        timeout: options?.timeout,
        compression: options?.compression,
      });

      logger.debug(
        {
          topic: event.topic,
          key: event.key,
          partitions: metadata.map((m) => m.partition),
        },
        '[KafkaProducer] Event published successfully',
      );

      return metadata;
    } catch (error) {
      logger.error(
        { topic: event.topic, key: event.key, error },
        '[KafkaProducer] Failed to publish event',
      );
      throw error;
    }
  }

  /**
   * Publishes a batch of messages to a specific topic for maximum throughput.
   */
  public async publishBatch<T = unknown>(
    topic: string,
    events: Array<{
      key?: string;
      value: T;
      headers?: Record<string, string>;
      partition?: number;
    }>,
    options?: PublishOptions,
  ): Promise<RecordMetadata[]> {
    if (!isKafkaConfigured()) {
      logger.warn(
        { topic, count: events.length },
        '[KafkaProducer] Kafka not configured; batch skipped',
      );
      return [];
    }

    if (!this.isConnected) {
      await this.connect();
    }

    if (!this.producer) {
      throw new Error('[KafkaProducer] Producer is not initialized');
    }

    const messages: Message[] = events.map((event) => ({
      key: event.key,
      value: this.serializeValue(event.value),
      headers: event.headers,
      partition: event.partition,
      timestamp: Date.now().toString(),
    }));

    try {
      const metadata = await this.producer.send({
        topic,
        messages,
        acks: options?.acks,
        timeout: options?.timeout,
        compression: options?.compression,
      });

      logger.debug(
        { topic, count: messages.length },
        '[KafkaProducer] Batch events published successfully',
      );

      return metadata;
    } catch (error) {
      logger.error(
        { topic, count: messages.length, error },
        '[KafkaProducer] Failed to publish batch',
      );
      throw error;
    }
  }

  /**
   * Checks whether the producer is currently connected.
   */
  public getIsConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Gracefully flushes and disconnects the Kafka producer.
   */
  public async disconnect(): Promise<void> {
    if (this.producer && this.isConnected) {
      try {
        await this.producer.disconnect();
        this.isConnected = false;
        logger.info('[KafkaProducer] Producer disconnected successfully');
      } catch (error) {
        logger.error({ error }, '[KafkaProducer] Error disconnecting producer');
        throw error;
      }
    }
  }
}

export const kafkaProducer = new KafkaProducer();
