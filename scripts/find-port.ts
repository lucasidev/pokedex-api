/**
 * find-port.ts: returns the first available TCP port starting from a base.
 *
 * Used by ensure-infra.ts to avoid colliding with whatever is already
 * listening on the default ports of mongo (27017) or redis (6379).
 *
 * Usage:
 *   npx tsx scripts/find-port.ts 27017     // prints the port to stdout
 *
 * Exit codes:
 *   0  on success (port number printed to stdout)
 *   1  if no port is free within MAX_ATTEMPTS of the base
 */

import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';

const MAX_ATTEMPTS = 20;

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findPort(basePort: number): Promise<number> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const port = basePort + i;
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error(`No available port found in range ${basePort}..${basePort + MAX_ATTEMPTS - 1}`);
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const basePort = Number(process.argv[2]);
  if (!basePort || basePort < 1 || basePort > 65535) {
    console.error('Usage: npx tsx scripts/find-port.ts <base-port>');
    process.exit(1);
  }
  try {
    const port = await findPort(basePort);
    process.stdout.write(`${port}\n`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
