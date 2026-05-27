import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from './logger.js';
import {
  pokeapiErrorsTotal,
  pokeapiRequestDurationSeconds,
  pokeapiRequestsTotal,
} from './metrics.js';

export interface PokemonSummary {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: string[];
  sprites: {
    front_default: string | null;
    back_default: string | null;
  };
  stats: { name: string; base: number }[];
  abilities: string[];
}

interface PokeApiRawPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: { type: { name: string } }[];
  sprites: { front_default: string | null; back_default: string | null };
  stats: { base_stat: number; stat: { name: string } }[];
  abilities: { ability: { name: string } }[];
}

export class PokeApiError extends AppError {
  constructor(statusCode: number, message: string) {
    const code =
      statusCode === 404 ? 'Not Found' : statusCode === 502 ? 'Bad Gateway' : 'PokeAPI Error';
    super(statusCode, code, message);
    this.name = 'PokeApiError';
  }
}

function normalize(raw: PokeApiRawPokemon): PokemonSummary {
  return {
    id: raw.id,
    name: raw.name,
    height: raw.height,
    weight: raw.weight,
    types: raw.types.map((t) => t.type.name),
    sprites: {
      front_default: raw.sprites.front_default,
      back_default: raw.sprites.back_default,
    },
    stats: raw.stats.map((s) => ({ name: s.stat.name, base: s.base_stat })),
    abilities: raw.abilities.map((a) => a.ability.name),
  };
}

export async function fetchPokemonByName(name: string): Promise<PokemonSummary> {
  const url = `${env.POKEAPI_BASE_URL}/pokemon/${encodeURIComponent(name.toLowerCase())}`;
  const startNs = process.hrtime.bigint();

  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    pokeapiErrorsTotal.inc({ kind: 'network' });
    logger.error({ err, url }, 'pokeapi network error');
    throw new PokeApiError(502, 'pokeapi unreachable');
  }

  const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1e9;
  pokeapiRequestsTotal.inc({ status_code: String(response.status) });
  pokeapiRequestDurationSeconds.observe({ status_code: String(response.status) }, durationSeconds);

  if (response.status === 404) {
    throw new PokeApiError(404, `pokemon '${name}' not found`);
  }
  if (!response.ok) {
    pokeapiErrorsTotal.inc({ kind: 'http' });
    throw new PokeApiError(response.status, `pokeapi error: ${response.status}`);
  }

  const raw = (await response.json()) as PokeApiRawPokemon;
  return normalize(raw);
}
