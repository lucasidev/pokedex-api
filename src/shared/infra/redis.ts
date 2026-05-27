import { type RedisClientType, createClient } from 'redis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let client: RedisClientType | null = null;

export function isRedisEnabled(): boolean {
  return Boolean(env.REDIS_URL);
}

export async function connectRedis(): Promise<RedisClientType | null> {
  if (!env.REDIS_URL) {
    logger.warn('REDIS_URL not set, pokeapi proxy will bypass cache');
    return null;
  }
  const c: RedisClientType = createClient({ url: env.REDIS_URL });
  c.on('error', (err) => {
    logger.error({ err }, 'redis error');
  });
  await c.connect();
  client = c;
  logger.info({ url: env.REDIS_URL }, 'redis connected');
  return c;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    logger.info('redis disconnected');
  }
}

export function getRedis(): RedisClientType | null {
  return client;
}

export async function pingRedis(): Promise<void> {
  if (!client) {
    throw new Error('redis not connected');
  }
  await client.ping();
}
