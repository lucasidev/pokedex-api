/**
 * ensure-infra.ts: starts mongo + redis with healthchecks, picking free
 * host ports if the defaults are taken and persisting the chosen ports
 * back into .env so the API and any other consumer (mongo shell, redis
 * CLI, the app under tsx watch) all agree on the URLs.
 *
 * Flow:
 *   1. Detect container runtime (podman / docker).
 *   2. Inspect running containers; if mongo or redis are up already,
 *      reuse their published host port. Skip starting them again.
 *   3. For services that are not running, find a free host port from
 *      the default (27017 for mongo, 6379 for redis).
 *   4. Rewrite the resolved ports + connection strings into .env.
 *   5. Run `<cmd> compose up -d`.
 *   6. Wait for healthchecks (mongo ping, redis ping) before returning.
 *
 * Usage:
 *   npx tsx scripts/ensure-infra.ts             // autodetect runtime
 *   CONTAINER_CMD=docker npx tsx scripts/ensure-infra.ts
 *
 * Exit codes:
 *   0  containers are running and healthy
 *   1  failure starting a container or waiting for healthcheck
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectContainerRuntime } from './detect-container.js';
import { findPort } from './find-port.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT, '.env');

const COMPOSE_EXEC_TIMEOUT_MS = 5000;
const COMPOSE_PS_TIMEOUT_MS = 10000;

interface ServicePorts {
  mongo: number;
  redis: number;
}

const containerCmd = detectContainerRuntime();
const compose = `${containerCmd} compose`;

function readEnvVar(path: string, key: string): string | null {
  if (!existsSync(path)) return null;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    if (trimmed.slice(0, eq).trim() === key) {
      return trimmed.slice(eq + 1).trim();
    }
  }
  return null;
}

function updateEnvFile(path: string, updates: Record<string, string>): void {
  if (!existsSync(path)) {
    console.error(`Warning: ${path} does not exist. Create it from .env.example first.`);
    return;
  }
  let content = readFileSync(path, 'utf8');
  for (const [k, v] of Object.entries(updates)) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${escaped}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${k}=${v}`);
    } else {
      content += `\n${k}=${v}`;
    }
  }
  writeFileSync(path, content, 'utf8');
}

function getRunningPorts(): Partial<ServicePorts> {
  const ports: Partial<ServicePorts> = {};
  try {
    const output = execSync(`${compose} ps --status running --format json`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: COMPOSE_PS_TIMEOUT_MS,
    });
    for (const line of output.trim().split('\n')) {
      if (!line) continue;
      try {
        const c = JSON.parse(line) as {
          Service?: string;
          Name?: string;
          Publishers?: { TargetPort: number; PublishedPort: number }[];
          Ports?: string;
        };
        const name = c.Service ?? c.Name ?? '';
        const publishers = c.Publishers ?? [];
        const portStr = c.Ports ?? '';
        if (name.includes('mongo')) {
          const pub = publishers.find((p) => p.TargetPort === 27017);
          if (pub?.PublishedPort) {
            ports.mongo = pub.PublishedPort;
          } else {
            const m = portStr.match(/:(\d+)->27017/);
            if (m?.[1]) ports.mongo = Number(m[1]);
          }
        }
        if (name.includes('redis')) {
          const pub = publishers.find((p) => p.TargetPort === 6379);
          if (pub?.PublishedPort) {
            ports.redis = pub.PublishedPort;
          } else {
            const m = portStr.match(/:(\d+)->6379/);
            if (m?.[1]) ports.redis = Number(m[1]);
          }
        }
      } catch {
        // ignore non-JSON lines
      }
    }
  } catch {
    // compose ps failed, treat as nothing running
  }
  return ports;
}

function envUpdates(ports: ServicePorts): Record<string, string> {
  const mongoUser = readEnvVar(ENV_PATH, 'MONGO_ROOT_USER') ?? 'pokedex';
  const mongoPwd = readEnvVar(ENV_PATH, 'MONGO_ROOT_PASSWORD') ?? '';
  const redisPwd = readEnvVar(ENV_PATH, 'REDIS_PASSWORD') ?? '';
  const mongoUri = `mongodb://${mongoUser}:${mongoPwd}@localhost:${ports.mongo}/pokedex?authSource=admin`;
  const redisUrl = `redis://:${redisPwd}@localhost:${ports.redis}`;
  return {
    MONGO_HOST_PORT: String(ports.mongo),
    REDIS_HOST_PORT: String(ports.redis),
    MONGODB_URI: mongoUri,
    REDIS_URL: redisUrl,
  };
}

async function waitForService(name: string, check: () => void, maxSeconds = 60): Promise<void> {
  console.error(`Waiting for ${name}...`);
  for (let i = 0; i < maxSeconds; i++) {
    try {
      check();
      console.error(`  ${name} ready`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.error(`  ${name} failed to become ready within ${maxSeconds}s`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!existsSync(ENV_PATH)) {
    console.error('.env not found. Copy .env.example to .env first.');
    process.exit(1);
  }

  const running = getRunningPorts();
  let mongoPort: number;
  let redisPort: number;

  if (running.mongo && running.redis) {
    mongoPort = running.mongo;
    redisPort = running.redis;
    console.error(`Infrastructure already running. mongo: ${mongoPort}, redis: ${redisPort}.`);
  } else {
    mongoPort = running.mongo ?? (await findPort(27017));
    redisPort = running.redis ?? (await findPort(6379));
    console.error(`Starting infrastructure. mongo: ${mongoPort}, redis: ${redisPort}.`);

    updateEnvFile(ENV_PATH, envUpdates({ mongo: mongoPort, redis: redisPort }));

    try {
      execSync(`${compose} up -d`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'inherit'],
        env: {
          ...process.env,
          MONGO_HOST_PORT: String(mongoPort),
          REDIS_HOST_PORT: String(redisPort),
          MONGO_ROOT_PASSWORD: readEnvVar(ENV_PATH, 'MONGO_ROOT_PASSWORD') ?? '',
          REDIS_PASSWORD: readEnvVar(ENV_PATH, 'REDIS_PASSWORD') ?? '',
        },
      });
    } catch (err) {
      const e = err as { stderr?: string };
      console.error(`Failed to start infrastructure: ${e.stderr ?? err}`);
      process.exit(1);
    }

    await waitForService('mongo', () => {
      execSync(`${compose} exec mongo mongosh --quiet --eval "db.adminCommand('ping')"`, {
        stdio: 'ignore',
        timeout: COMPOSE_EXEC_TIMEOUT_MS,
      });
    });

    const redisPwd = readEnvVar(ENV_PATH, 'REDIS_PASSWORD') ?? '';
    await waitForService('redis', () => {
      execSync(`${compose} exec redis redis-cli -a "${redisPwd}" --no-auth-warning ping`, {
        stdio: 'ignore',
        timeout: COMPOSE_EXEC_TIMEOUT_MS,
      });
    });
  }

  updateEnvFile(ENV_PATH, envUpdates({ mongo: mongoPort, redis: redisPort }));

  console.error('');
  console.error('Infrastructure ready.');
  console.error(`  Mongo:  localhost:${mongoPort}`);
  console.error(`  Redis:  localhost:${redisPort}`);
}

await main();
