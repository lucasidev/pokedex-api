import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { cacheHitsTotal, cacheMissesTotal } from '../lib/metrics.js';
import { type PokemonSummary, fetchPokemonByName } from '../lib/pokeapi.js';
import { getRedis } from '../lib/redis.js';

const CACHE_NAMESPACE = 'pokemon';

function cacheKey(name: string): string {
  return `${CACHE_NAMESPACE}:${name.toLowerCase()}`;
}

async function readCache(name: string): Promise<PokemonSummary | null> {
  const redis = getRedis();
  if (!redis) {
    return null;
  }
  try {
    const raw = await redis.get(cacheKey(name));
    return raw ? (JSON.parse(raw) as PokemonSummary) : null;
  } catch (err) {
    logger.warn({ err, name }, 'redis read failed, bypassing cache');
    return null;
  }
}

async function writeCache(pokemon: PokemonSummary): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }
  try {
    await redis.set(cacheKey(pokemon.name), JSON.stringify(pokemon), {
      EX: env.POKEAPI_CACHE_TTL_SECONDS,
    });
  } catch (err) {
    logger.warn({ err, name: pokemon.name }, 'redis write failed');
  }
}

export async function getPokemonByName(name: string): Promise<PokemonSummary> {
  const cached = await readCache(name);
  if (cached) {
    cacheHitsTotal.inc({ resource: CACHE_NAMESPACE });
    return cached;
  }
  cacheMissesTotal.inc({ resource: CACHE_NAMESPACE });

  const pokemon = await fetchPokemonByName(name);
  await writeCache(pokemon);
  return pokemon;
}
