import { Consumer, ConsumerConfig, EachMessagePayload, IHeaders } from 'kafkajs';
import { getKafkaClient, isKafkaConfigured } from './connection';
import { kafkaConfig, logger } from '../../config';

export interface ParsedKafkaMessage<T = unknown> {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: T;
  headers: Record<string, string>;
  timestamp: string;
}

export type KafkaMessageHandler<T = unknown> = (
  message: ParsedKafkaMessage<T>,
  payload: EachMessagePayload,
) => Promise<void>;

export interface RegisterConsumerOptions<T = unknown> {
  groupId?: string;
  topics: string[];
  fromBeginning?: boolean;
  handler: KafkaMessageHandler<T>;
  consumerConfig?: Partial<ConsumerConfig>;
}

export class KafkaConsumerManager {
  private consumers: Map<string, Consumer> = new Map();

  /**
   * Safely deserializes a raw message buffer into a parsed JSON object or raw string.
   */
  private parseMessageValue(value: Buffer | null): unknown {
    if (!value) {
      return null;
    }
    const stringVal = value.toString('utf-8');
    try {
      return JSON.parse(stringVal) as unknown;
    } catch {
      return stringVal;
    }
  }

  /**
   * Formats Kafka raw headers into a standard string record dictionary.
   */
  private parseHeaders(headers?: IHeaders): Record<string, string> {
    if (!headers) {
      return {};
    }
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (Buffer.isBuffer(value)) {
        result[key] = value.toString('utf-8');
      } else if (typeof value === 'string') {
        result[key] = value;
      } else if (Array.isArray(value)) {
        result[key] = value
          .map((item) => (Buffer.isBuffer(item) ? item.toString('utf-8') : item))
          .join(',');
      }
    }
    return result;
  }

  /**
   * Registers, connects, subscribes, and starts consuming messages for a consumer group.
   */
  public async registerConsumer<T = unknown>(
    options: RegisterConsumerOptions<T>,
  ): Promise<Consumer | null> {
    if (!isKafkaConfigured()) {
      logger.warn(
        { topics: options.topics },
        '[KafkaConsumer] Kafka brokers not configured; skipping consumer registration',
      );
      return null;
    }

    const groupId = options.groupId ?? kafkaConfig.groupId;

    if (this.consumers.has(groupId)) {
      logger.warn(
        { groupId },
        '[KafkaConsumer] Consumer group already registered; returning existing',
      );
      return this.consumers.get(groupId) ?? null;
    }

    const client = getKafkaClient();
    const consumer = client.consumer({
      groupId,
      allowAutoTopicCreation: true,
      ...options.consumerConfig,
    });

    try {
      await consumer.connect();
      logger.info({ groupId }, '[KafkaConsumer] Consumer group connected successfully');

      for (const topic of options.topics) {
        await consumer.subscribe({
          topic,
          fromBeginning: options.fromBeginning ?? false,
        });
      }

      await consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          const { topic, partition, message } = payload;
          const parsedMessage: ParsedKafkaMessage<T> = {
            topic,
            partition,
            offset: message.offset,
            key: message.key ? message.key.toString('utf-8') : null,
            value: this.parseMessageValue(message.value) as T,
            headers: this.parseHeaders(message.headers),
            timestamp: message.timestamp,
          };

          try {
            await options.handler(parsedMessage, payload);
          } catch (error) {
            logger.error(
              {
                topic,
                partition,
                offset: message.offset,
                groupId,
                error,
              },
              '[KafkaConsumer] Error while processing consumed message',
            );
            throw error;
          }
        },
      });

      this.consumers.set(groupId, consumer);
      return consumer;
    } catch (error) {
      logger.error({ groupId, error }, '[KafkaConsumer] Failed to initialize consumer group');
      throw error;
    }
  }

  /**
   * Retrieves an active consumer instance by its group ID.
   */
  public getConsumer(groupId: string): Consumer | undefined {
    return this.consumers.get(groupId);
  }

  /**
   * Returns the count of actively registered consumers.
   */
  public getActiveConsumerCount(): number {
    return this.consumers.size;
  }

  /**
   * Disconnects and removes a specific consumer by its group ID.
   */
  public async disconnectConsumer(groupId: string): Promise<void> {
    const consumer = this.consumers.get(groupId);
    if (consumer) {
      try {
        await consumer.disconnect();
        this.consumers.delete(groupId);
        logger.info({ groupId }, '[KafkaConsumer] Consumer disconnected and removed');
      } catch (error) {
        logger.error({ groupId, error }, '[KafkaConsumer] Error disconnecting consumer');
        throw error;
      }
    }
  }

  /**
   * Gracefully disconnects all actively registered consumers.
   */
  public async closeAll(): Promise<void> {
    const disconnectPromises = Array.from(this.consumers.entries()).map(
      async ([groupId, consumer]) => {
        try {
          await consumer.disconnect();
          logger.info({ groupId }, '[KafkaConsumer] Consumer closed successfully');
        } catch (error) {
          logger.error({ groupId, error }, '[KafkaConsumer] Error closing consumer');
        }
      },
    );

    await Promise.allSettled(disconnectPromises);
    this.consumers.clear();
    logger.info('[KafkaConsumer] All Kafka consumers closed');
  }
}

export const kafkaConsumerManager = new KafkaConsumerManager();
