import { env } from './env';

export const databaseConfig = {
  uri: env.MONGODB_URI,
  options: {
    serverSelectionTimeoutMS: 5000,
    autoIndex: env.NODE_ENV !== 'production',
  },
} as const;
