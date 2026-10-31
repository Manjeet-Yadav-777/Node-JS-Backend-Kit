import { createApp } from './app';
import { env, logger, connectDatabase, disconnectDatabase } from './config';

async function bootstrap(): Promise<void> {
  const app = createApp();

  if (env.MONGODB_URI) {
    try {
      await connectDatabase();
    } catch (error) {
      logger.warn({ error }, 'Database initialization failed, continuing in degraded mode');
    }
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  async function handleGracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    server.close(async (err) => {
      if (err) {
        logger.error({ err }, 'Error occurred while closing server');
      } else {
        logger.info('HTTP server closed successfully');
      }

      await disconnectDatabase();
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
