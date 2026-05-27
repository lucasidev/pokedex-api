import type { Request, Response } from 'express';

const SERVICE_INFO = {
  message: 'Welcome to pokedex-api',
  name: 'pokedex-api',
  description: 'Pokedex REST API with JWT auth, PokeAPI proxy and Redis cache',
} as const;

export function welcome(_req: Request, res: Response): void {
  res.json({
    ...SERVICE_INFO,
    version: process.env.npm_package_version ?? 'unknown',
  });
}
