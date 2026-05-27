import mongoose from 'mongoose';
import { isRedisEnabled, pingRedis } from '../shared/infra/redis.js';

export type CheckStatus = 'ok' | 'fail';

export interface DependencyCheck {
  name: string;
  status: CheckStatus;
  latencyMs?: number;
  error?: string;
}

export interface HealthReport {
  status: CheckStatus;
  uptimeSeconds: number;
  checks: DependencyCheck[];
}

async function timed<T>(name: string, fn: () => Promise<T>): Promise<DependencyCheck> {
  const start = Date.now();
  try {
    await fn();
    return { name, status: 'ok', latencyMs: Date.now() - start };
  } catch (error) {
    return {
      name,
      status: 'fail',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkMongo(): Promise<DependencyCheck> {
  return timed('mongo', async () => {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      throw new Error('mongo not connected');
    }
    await mongoose.connection.db.admin().ping();
  });
}

async function checkRedis(): Promise<DependencyCheck> {
  return timed('redis', () => pingRedis());
}

export async function runHealthChecks(): Promise<HealthReport> {
  const promises: Promise<DependencyCheck>[] = [checkMongo()];
  if (isRedisEnabled()) {
    promises.push(checkRedis());
  }
  const checks = await Promise.all(promises);
  const status: CheckStatus = checks.every((c) => c.status === 'ok') ? 'ok' : 'fail';
  return {
    status,
    uptimeSeconds: Math.floor(process.uptime()),
    checks,
  };
}
