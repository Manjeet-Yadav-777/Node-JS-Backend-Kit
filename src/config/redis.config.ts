import { env } from './env';

export const redisConfig = {
  url: env.REDIS_URL ?? 'redis://localhost:6379',
} as const;
