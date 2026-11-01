import Redis, { RedisOptions } from 'ioredis';
import { redisConfig, logger } from '../../../config';

const activeBullMQClients: Redis[] = [];

/**
 * Returns connection options configured specifically for BullMQ.
 * BullMQ requires maxRetriesPerRequest to be null for blocking commands.
 */
export function getBullMQConnectionOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times: number) {
      const delay = Math.min(times * 100, 3000);
      logger.warn({ attempt: times, delayMs: delay }, 'BullMQ Redis reconnecting...');
      return delay;
    },
  };
}

/**
 * Creates a dedicated Redis connection for BullMQ Queues and Workers.
 */
export function createBullMQConnection(): Redis {
  const client = new Redis(redisConfig.url, getBullMQConnectionOptions());

  client.on('error', (error) => {
    logger.error({ error }, 'BullMQ Redis connection error');
  });

  activeBullMQClients.push(client);
  return client;
}

/**
 * Gracefully terminates all active BullMQ Redis connections.
 */
export async function closeAllBullMQConnections(): Promise<void> {
  const closePromises = activeBullMQClients.map(async (client) => {
    try {
      if (client.status !== 'end') {
        await client.quit();
      }
    } catch (error) {
      logger.error({ error }, 'Error terminating BullMQ Redis connection');
    }
  });

  await Promise.all(closePromises);
  activeBullMQClients.length = 0;
  logger.info('All BullMQ Redis connections closed successfully');
}
