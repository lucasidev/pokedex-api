import { jest } from '@jest/globals';

// Mock the redis adapter so the cache-aside branches in pokemon.service
// (hit, miss + write, read error fail-open) are exercised without a real
// redis. The module is imported dynamically after the mock is registered.
const redisGet = jest.fn<(key: string) => Promise<string | null>>();
const redisSet = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const getRedis = jest.fn<() => { get: typeof redisGet; set: typeof redisSet } | null>();

jest.unstable_mockModule('../src/shared/infra/redis.js', () => ({
  getRedis,
  isRedisEnabled: jest.fn(() => true),
  pingRedis: jest.fn(),
  connectRedis: jest.fn(),
  disconnectRedis: jest.fn(),
}));

const { getPokemonByName } = await import('../src/pokemon/pokemon.service.js');

const rawPikachu = {
  id: 25,
  name: 'pikachu',
  height: 4,
  weight: 60,
  types: [{ type: { name: 'electric' } }],
  sprites: { front_default: 'https://example.com/p.png', back_default: null },
  stats: [{ base_stat: 35, stat: { name: 'hp' } }],
  abilities: [{ ability: { name: 'static' } }],
};

const normalizedPikachu = {
  id: 25,
  name: 'pikachu',
  height: 4,
  weight: 60,
  types: ['electric'],
  sprites: { front_default: 'https://example.com/p.png', back_default: null },
  stats: [{ name: 'hp', base: 35 }],
  abilities: ['static'],
};

describe('pokemon.service cache-aside', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRedis.mockReturnValue({ get: redisGet, set: redisSet });
  });

  it('returns the cached value on a hit without calling pokeapi', async () => {
    redisGet.mockResolvedValue(JSON.stringify(normalizedPikachu));
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await getPokemonByName('pikachu');

    expect(result).toEqual(normalizedPikachu);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('fetches from pokeapi and writes to cache on a miss', async () => {
    redisGet.mockResolvedValue(null);
    redisSet.mockResolvedValue('OK');
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(rawPikachu), { status: 200 }));

    const result = await getPokemonByName('pikachu');

    expect(result.name).toBe('pikachu');
    expect(result.stats).toEqual([{ name: 'hp', base: 35 }]);
    expect(redisSet).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('falls open to pokeapi when the redis read throws', async () => {
    redisGet.mockRejectedValue(new Error('redis down'));
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(rawPikachu), { status: 200 }));

    const result = await getPokemonByName('pikachu');

    expect(result.name).toBe('pikachu');
    fetchSpy.mockRestore();
  });

  it('bypasses the cache entirely when redis is not configured', async () => {
    getRedis.mockReturnValue(null);
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(rawPikachu), { status: 200 }));

    const result = await getPokemonByName('pikachu');

    expect(result.name).toBe('pikachu');
    expect(redisGet).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
