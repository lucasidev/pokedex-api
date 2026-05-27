import request from 'supertest';
import app from '../src/app.js';
import { RoleModel } from '../src/models/Role.js';
import { clearDatabase, startInMemoryMongo, stopInMemoryMongo } from './helpers/testDb.js';

async function registerAndGetToken(email: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({
      name: 'Tester',
      username: email.split('@')[0],
      email,
      password: 'tester12345',
    });
  return res.body.token as string;
}

describe('Users endpoints', () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    await clearDatabase();
    await RoleModel.create([{ name: 'user' }, { name: 'admin' }]);
  });

  describe('GET /api/users/using-token', () => {
    it('returns the authenticated user', async () => {
      const token = await registerAndGetToken('paula@example.com');

      const res = await request(app)
        .get('/api/users/using-token')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.result.email).toBe('paula@example.com');
      expect(res.body.result.password).toBeUndefined();
    });

    it('accepts the legacy x-access-token header', async () => {
      const token = await registerAndGetToken('paula2@example.com');

      const res = await request(app).get('/api/users/using-token').set('x-access-token', token);

      expect(res.status).toBe(200);
    });

    it('returns 403 without a token', async () => {
      const res = await request(app).get('/api/users/using-token');
      expect(res.status).toBe(403);
    });

    it('returns 401 on a tampered token', async () => {
      const res = await request(app)
        .get('/api/users/using-token')
        .set('Authorization', 'Bearer not-a-jwt');

      expect(res.status).toBe(401);
    });
  });

  describe('Pokedex operations', () => {
    let token: string;

    beforeEach(async () => {
      token = await registerAndGetToken('martin@example.com');
    });

    it('catches a pokemon and lists it in the pokedex', async () => {
      const catchRes = await request(app)
        .put('/api/users/pokedex/catch-pokemon')
        .set('Authorization', `Bearer ${token}`)
        .send({ pokemonName: 'pikachu' });
      expect(catchRes.status).toBe(200);

      const listRes = await request(app)
        .get('/api/users/pokedex')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.body.result).toContain('pikachu');
    });

    it('rejects catch when pokemonName is missing', async () => {
      const res = await request(app)
        .put('/api/users/pokedex/catch-pokemon')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('releases a previously caught pokemon', async () => {
      await request(app)
        .put('/api/users/pokedex/catch-pokemon')
        .set('Authorization', `Bearer ${token}`)
        .send({ pokemonName: 'bulbasaur' });

      const releaseRes = await request(app)
        .put('/api/users/pokedex/release-pokemon')
        .set('Authorization', `Bearer ${token}`)
        .send({ pokemonName: 'bulbasaur' });
      expect(releaseRes.status).toBe(200);

      const listRes = await request(app)
        .get('/api/users/pokedex')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.body.result).not.toContain('bulbasaur');
    });
  });
});
