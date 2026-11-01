import { createApp } from './app';
import { appConfig, logger } from './config';
import {
  connectMongoDB,
  disconnectMongoDB,
  connectRedis,
  disconnectRedis,
  closeAllBullMQConnections,
  queueManager,
} from './infrastructure';

async function bootstrap(): Promise<void> {
  const app = createApp();

  try {
    await connectMongoDB();
  } catch (error) {
    logger.warn({ error }, 'MongoDB connection initialization failed, continuing in degraded mode');
  }

  try {
    await connectRedis();
  } catch (error) {
    logger.warn({ error }, 'Redis connection initialization failed, continuing in degraded mode');
  }

  const server = app.listen(appConfig.port, () => {
    logger.info(`Server is running on port ${appConfig.port} in ${appConfig.env} mode`);
  });

  async function handleGracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error occurred while closing HTTP server');
      } else {
        logger.info('HTTP server closed successfully');
      }

      await disconnectMongoDB();
      await disconnectRedis();
      await queueManager.closeAll();
      await closeAllBullMQConnections();
      process.exit(err ? 1 : 0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000).unref();
  }

  process.on('SIGINT', () => {
    void handleGracefulShutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void handleGracefulShutdown('SIGTERM');
  });
}

void bootstrap();

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ reason }, 'Unhandled Promise Rejection detected');
});

process.on('uncaughtException', (error: Error) => {
  logger.error({ error }, 'Uncaught Exception detected. Exiting process.');
  process.exit(1);
});
