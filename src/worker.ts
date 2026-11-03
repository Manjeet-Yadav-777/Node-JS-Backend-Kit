import { logger } from './config';
import {
  connectRedis,
  disconnectRedis,
  workerManager,
  closeAllBullMQConnections,
} from './infrastructure';
import { startEmailWorker } from './jobs';

async function bootstrapWorker(): Promise<void> {
  logger.info('[Worker Process] Initializing background queue worker process...');

  try {
    await connectRedis();
    logger.info('[Worker Process] Redis connected for BullMQ workers');

    // Register and start all background workers
    startEmailWorker();
    logger.info('[Worker Process] Email worker started and listening for jobs');
  } catch (error) {
    logger.error({ error }, '[Worker Process] Failed to initialize worker dependencies');
    process.exit(1);
  }

  async function handleGracefulShutdown(signal: string): Promise<void> {
    logger.info(`[Worker Process] Received ${signal}. Shutting down worker gracefully...`);

    try {
      await workerManager.closeAll();
      await closeAllBullMQConnections();
      await disconnectRedis();
      logger.info('[Worker Process] All queue workers closed cleanly');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, '[Worker Process] Error during worker graceful shutdown');
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

void bootstrapWorker();

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ reason }, '[Worker Process] Unhandled Promise Rejection detected');
});

process.on('uncaughtException', (error: Error) => {
  logger.error({ error }, '[Worker Process] Uncaught Exception detected. Exiting.');
  process.exit(1);
});
