import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export async function connectDatabase(): Promise<typeof mongoose> {
  try {
    const connection = await mongoose.connect(env.MONGODB_URI);
    logger.info({ db: connection.connection.name }, 'mongo connected');
    return connection;
  } catch (error) {
    logger.error({ err: error }, 'mongo connection failed');
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('mongo disconnected');
}
