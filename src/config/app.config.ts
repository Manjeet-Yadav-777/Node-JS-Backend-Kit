import { env } from './env';

export const appConfig = {
  name: 'Backend Starter Kit',
  env: env.NODE_ENV,
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  corsOrigin: env.CORS_ORIGIN,
} as const;
