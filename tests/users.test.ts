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
  return res.body.token as string;
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
      expect(res.body.email).toBe('paula@example.com');
      expect(res.body.password).toBeUndefined();
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
      expect(catchRes.status).toBe(204);

      const listRes = await request(app)
        .get('/api/users/pokedex')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.body).toContain('pikachu');
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
      expect(releaseRes.status).toBe(204);

      const listRes = await request(app)
        .get('/api/users/pokedex')
        .set('Authorization', `Bearer ${token}`);
      expect(listRes.body).not.toContain('bulbasaur');
    });

    it('rejects catching a duplicate pokemon with 400', async () => {
      const url = '/api/users/pokedex/catch-pokemon';
      await request(app)
        .put(url)
        .set('Authorization', `Bearer ${token}`)
        .send({ pokemonName: 'eevee' });
      const dup = await request(app)
        .put(url)
        .set('Authorization', `Bearer ${token}`)
        .send({ pokemonName: 'eevee' });

      expect(dup.status).toBe(400);
      expect(dup.body.message).toMatch(/already/i);
    });

    it('rejects catching beyond the pokedex limit with 400', async () => {
      const url = '/api/users/pokedex/catch-pokemon';
      const names = ['pikachu', 'charmander', 'squirtle', 'bulbasaur', 'eevee'];
      for (const name of names) {
        await request(app)
          .put(url)
          .set('Authorization', `Bearer ${token}`)
          .send({ pokemonName: name });
      }

      const overflow = await request(app)
        .put(url)
        .set('Authorization', `Bearer ${token}`)
        .send({ pokemonName: 'mewtwo' });

      expect(overflow.status).toBe(400);
      expect(overflow.body.message).toMatch(/full/i);
    });
  });

  describe('Poketeam operations', () => {
    let token: string;

    beforeEach(async () => {
      token = await registerAndGetToken('trainer@example.com');
    });

    const auth = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

    it('starts with no team', async () => {
      const res = await auth(request(app).get('/api/users/poketeam'));
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('creates a team, adds and removes a pokemon, then deletes the team', async () => {
      const create = await auth(
        request(app).put('/api/users/poketeam/create').send({ teamName: 'Kanto' }),
      );
      expect(create.status).toBe(204);

      const afterCreate = await auth(request(app).get('/api/users/poketeam'));
      expect(afterCreate.body.name).toBe('Kanto');
      expect(afterCreate.body.pokemon).toEqual([]);

      const add = await auth(
        request(app).put('/api/users/poketeam/add-pokemon').send({ pokemonName: 'charizard' }),
      );
      expect(add.status).toBe(204);

      const afterAdd = await auth(request(app).get('/api/users/poketeam'));
      expect(afterAdd.body.pokemon).toContain('charizard');

      const remove = await auth(
        request(app).put('/api/users/poketeam/remove-pokemon').send({ pokemonName: 'charizard' }),
      );
      expect(remove.status).toBe(204);

      const afterRemove = await auth(request(app).get('/api/users/poketeam'));
      expect(afterRemove.body.pokemon).not.toContain('charizard');

      const del = await auth(request(app).put('/api/users/poketeam/delete'));
      expect(del.status).toBe(204);

      const afterDelete = await auth(request(app).get('/api/users/poketeam'));
      expect(afterDelete.body).toBeNull();
    });

    it('rejects adding to a team that does not exist with 404', async () => {
      const res = await auth(
        request(app).put('/api/users/poketeam/add-pokemon').send({ pokemonName: 'snorlax' }),
      );
      expect(res.status).toBe(404);
    });

    it('rejects a duplicate team member with 400', async () => {
      await auth(request(app).put('/api/users/poketeam/create').send({ teamName: 'Johto' }));
      await auth(
        request(app).put('/api/users/poketeam/add-pokemon').send({ pokemonName: 'lugia' }),
      );
      const dup = await auth(
        request(app).put('/api/users/poketeam/add-pokemon').send({ pokemonName: 'lugia' }),
      );
      expect(dup.status).toBe(400);
      expect(dup.body.message).toMatch(/already/i);
    });

    it('rejects adding beyond the team limit with 400', async () => {
      await auth(request(app).put('/api/users/poketeam/create').send({ teamName: 'Hoenn' }));
      for (const name of ['mudkip', 'treecko', 'torchic']) {
        await auth(request(app).put('/api/users/poketeam/add-pokemon').send({ pokemonName: name }));
      }
      const overflow = await auth(
        request(app).put('/api/users/poketeam/add-pokemon').send({ pokemonName: 'rayquaza' }),
      );
      expect(overflow.status).toBe(400);
      expect(overflow.body.message).toMatch(/full/i);
    });
  });

  describe('POST /api/users (admin create)', () => {
    it('lets an admin create a user and returns it without the password', async () => {
      const adminToken = await createAdminAndGetToken();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Created By Admin',
          username: 'created',
          email: 'created@example.com',
          password: 'created12345',
        });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('created@example.com');
      expect(res.body.password).toBeUndefined();
    });

    it('rejects unknown roles with 400', async () => {
      const adminToken = await createAdminAndGetToken();

      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bad Role',
          username: 'badrole',
          email: 'badrole@example.com',
          password: 'badrole12345',
          roles: ['superadmin'],
        });

      expect(res.status).toBe(400);
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
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
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
      expect(res.body.email).toBe('target@example.com');
      expect(res.body.password).toBeUndefined();
    });
  });
});
