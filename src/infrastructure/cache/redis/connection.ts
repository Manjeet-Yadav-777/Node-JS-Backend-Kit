import Redis, { RedisOptions } from 'ioredis';
import { redisConfig, logger } from '../../../config';

let redisClient: Redis | null = null;
let isConnected = false;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const options: RedisOptions = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy(times: number) {
        const delay = Math.min(times * 100, 3000);
        logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting...');
        return delay;
      },
    };

    redisClient = new Redis(redisConfig.url, options);

    redisClient.on('connect', () => {
      logger.info('Redis connection initiated');
    });

    redisClient.on('ready', () => {
      isConnected = true;
      logger.info('Redis client ready to handle operations');
    });

    redisClient.on('error', (error) => {
      isConnected = false;
      logger.error({ error }, 'Redis connection error detected');
    });

    redisClient.on('close', () => {
      isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  if (redisClient.status === 'wait') {
    void redisClient.connect().catch((error) => {
      logger.error({ error }, 'Redis connection initiation error');
    });
  }

  return redisClient;
}

export async function connectRedis(): Promise<Redis> {
  const client = getRedisClient();
  try {
    if (client.status === 'wait') {
      await client.connect();
    }
    return client;
  } catch (error) {
    logger.error({ error }, 'Failed to establish Redis connection');
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      isConnected = false;
      redisClient = null;
      logger.info('Redis connection terminated gracefully');
    } catch (error) {
      logger.error({ error }, 'Error disconnecting Redis client');
    }
  }
}

export function isRedisConnected(): boolean {
  return isConnected && redisClient?.status === 'ready';
}
