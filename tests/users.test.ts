import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';
import { env } from '../src/shared/config/env.js';
import { RoleModel } from '../src/users/role.model.js';
import { User } from '../src/users/user.model.js';
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
  return res.body.data.token as string;
}

async function createAdminAndGetToken(): Promise<string> {
  const adminRole = await RoleModel.findOne({ name: 'admin' });
  const admin = await User.create({
    name: 'Admin',
    username: 'admin',
    email: 'admin@example.com',
    password: 'admin12345',
    roles: adminRole ? [adminRole._id] : [],
    pokedex: [],
    poketeam: null,
  });
  return jwt.sign({ id: admin.id }, env.JWT_SECRET, { expiresIn: '1h' });
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
      expect(res.body.data.email).toBe('paula@example.com');
      expect(res.body.data.password).toBeUndefined();
    });

    it('accepts the legacy x-access-token header', async () => {
      const token = await registerAndGetToken('paula2@example.com');

      const res = await request(app).get('/api/users/using-token').set('x-access-token', token);

      expect(res.status).toBe(200);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/users/using-token');
      expect(res.status).toBe(401);
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
      expect(listRes.body.data).toContain('pikachu');
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
      expect(listRes.body.data).not.toContain('bulbasaur');
    });
  });

  describe('GET /api/users (list)', () => {
    it('rejects anonymous callers with 401', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
    });

    it('rejects authenticated non-admin callers with 403', async () => {
      const token = await registerAndGetToken('regular@example.com');
      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns the list to an admin', async () => {
      await registerAndGetToken('member@example.com');
      const adminToken = await createAdminAndGetToken();

      const res = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('GET /api/users/:id', () => {
    it('rejects anonymous callers with 401', async () => {
      await registerAndGetToken('target@example.com');
      const target = await User.findOne({ email: 'target@example.com' });
      const res = await request(app).get(`/api/users/${target?.id}`);
      expect(res.status).toBe(401);
    });

    it('returns the user to an authenticated caller', async () => {
      const callerToken = await registerAndGetToken('caller@example.com');
      await registerAndGetToken('target@example.com');
      const target = await User.findOne({ email: 'target@example.com' });

      const res = await request(app)
        .get(`/api/users/${target?.id}`)
        .set('Authorization', `Bearer ${callerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('target@example.com');
      expect(res.body.data.password).toBeUndefined();
    });
  });
});
