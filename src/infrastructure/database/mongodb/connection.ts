import mongoose from 'mongoose';
import { databaseConfig, logger } from '../../../config';

export async function connectMongoDB(): Promise<void> {
  try {
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connection established successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error detected');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB connection lost. Attempting reconnection...');
    });

    await mongoose.connect(databaseConfig.uri, databaseConfig.options);
  } catch (error) {
    logger.error({ error }, 'Failed to initialize MongoDB connection');
    throw error;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB connection terminated gracefully');
  } catch (error) {
    logger.error({ error }, 'Error terminating MongoDB connection');
  }
}

export function isMongoDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
