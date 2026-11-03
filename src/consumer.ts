import { logger } from './config';
import { isKafkaConfigured, kafkaConsumerManager, ParsedKafkaMessage } from './infrastructure';

async function bootstrapKafkaConsumers(): Promise<void> {
  logger.info('[Kafka Consumer Process] Initializing Kafka consumer runner...');

  if (!isKafkaConfigured()) {
    logger.warn(
      '[Kafka Consumer Process] Kafka brokers not configured. Set KAFKA_BROKERS in your .env to enable Kafka streaming.',
    );
    process.exit(0);
  }

  try {
    // Example: Register default domain event consumer groups
    await kafkaConsumerManager.registerConsumer({
      groupId: 'core-event-consumer-group',
      topics: ['user-events', 'audit-events'],
      fromBeginning: false,
      handler: async (message: ParsedKafkaMessage) => {
        logger.info(
          {
            topic: message.topic,
            partition: message.partition,
            offset: message.offset,
            key: message.key,
            value: message.value,
          },
          '[Kafka Consumer Process] Processed event successfully',
        );
      },
    });

    logger.info('[Kafka Consumer Process] All Kafka consumer groups registered and listening');
  } catch (error) {
    logger.error({ error }, '[Kafka Consumer Process] Failed to initialize Kafka consumers');
    process.exit(1);
  }

  async function handleGracefulShutdown(signal: string): Promise<void> {
    logger.info(
      `[Kafka Consumer Process] Received ${signal}. Shutting down consumers gracefully...`,
    );

    try {
      await kafkaConsumerManager.closeAll();
      logger.info('[Kafka Consumer Process] All Kafka consumers closed cleanly');
      process.exit(0);
    } catch (error) {
      logger.error(
        { error },
        '[Kafka Consumer Process] Error during Kafka consumer graceful shutdown',
      );
      process.exit(1);
    }
  }

  process.on('SIGINT', () => {
    void handleGracefulShutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void handleGracefulShutdown('SIGTERM');
  });
}

void bootstrapKafkaConsumers();

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ reason }, '[Kafka Consumer Process] Unhandled Promise Rejection detected');
});

process.on('uncaughtException', (error: Error) => {
  logger.error({ error }, '[Kafka Consumer Process] Uncaught Exception detected. Exiting.');
  process.exit(1);
});
