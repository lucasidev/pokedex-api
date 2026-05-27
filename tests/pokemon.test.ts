import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import { startInMemoryMongo, stopInMemoryMongo } from './helpers/testDb.js';

const rawPikachu = {
  id: 25,
  name: 'pikachu',
  height: 4,
  weight: 60,
  types: [{ type: { name: 'electric' } }],
  sprites: { front_default: 'https://example.com/p.png', back_default: null },
  stats: [
    { base_stat: 35, stat: { name: 'hp' } },
    { base_stat: 55, stat: { name: 'attack' } },
  ],
  abilities: [{ ability: { name: 'static' } }],
};

describe('GET /api/pokemon/:name (PokeAPI proxy)', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeAll(async () => {
    await startInMemoryMongo();
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch') as jest.SpiedFunction<typeof fetch>;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('returns a normalized pokemon on a 200 from pokeapi', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(rawPikachu), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const res = await request(app).get('/api/pokemon/pikachu');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: 25,
      name: 'pikachu',
      types: ['electric'],
      abilities: ['static'],
    });
    expect(res.body.data.stats).toEqual([
      { name: 'hp', base: 35 },
      { name: 'attack', base: 55 },
    ]);
  });

  it('returns 404 when pokeapi returns 404', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));

    const res = await request(app).get('/api/pokemon/missingno');

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('Not Found');
  });

  it('returns 502 when pokeapi is unreachable', async () => {
    fetchSpy.mockRejectedValue(new Error('econnrefused'));

    const res = await request(app).get('/api/pokemon/pikachu');

    expect(res.status).toBe(502);
  });

  it('lowercases the name before hitting pokeapi', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(rawPikachu), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await request(app).get('/api/pokemon/PIKACHU');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/pokemon/pikachu'),
      expect.any(Object),
    );
  });
});
