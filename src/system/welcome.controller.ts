import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Request, Response } from 'express';

const SERVICE_INFO = {
  message: 'Welcome to pokedex-api',
  name: 'pokedex-api',
  description: 'Pokedex REST API with JWT auth, PokeAPI proxy and Redis cache',
} as const;

// Read package.json at module load instead of relying on
// npm_package_version, which is only set when the process is launched
// by npm and ends up undefined inside the docker image.
const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../package.json');
const version = (JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string }).version;

export function welcome(_req: Request, res: Response): void {
  res.json({
    ...SERVICE_INFO,
    version,
  });
}
