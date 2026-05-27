import request from 'supertest';
import app from '../src/app.js';
import { RoleModel } from '../src/users/role.model.js';
import { User } from '../src/users/user.model.js';
import { clearDatabase, startInMemoryMongo, stopInMemoryMongo } from './helpers/testDb.js';

describe('Auth endpoints', () => {
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

  describe('POST /api/auth/signup', () => {
    it('creates a new user and returns a JWT', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Lucia Mansilla',
        username: 'lucia',
        email: 'lucia@example.com',
        password: 'lucia12345',
      });

      expect(res.status).toBe(201);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.token.split('.')).toHaveLength(3);
    });

    it('rejects missing fields with 400', async () => {
      const res = await request(app).post('/api/auth/signup').send({ username: 'incomplete' });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('Bad Request');
    });

    it('rejects duplicate username with 409', async () => {
      const payload = {
        name: 'Lucia',
        username: 'lucia',
        email: 'lucia@example.com',
        password: 'lucia12345',
      };
      await request(app).post('/api/auth/signup').send(payload);

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ ...payload, email: 'other@example.com' });

      expect(res.status).toBe(409);
    });

    it('ignores roles in the body and always assigns the user role', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Sneaky',
          username: 'sneaky',
          email: 'sneaky@example.com',
          password: 'sneaky12345',
          roles: ['admin'],
        });

      expect(res.status).toBe(201);

      const created = await User.findOne({ email: 'sneaky@example.com' }).populate<{
        roles: { name: string }[];
      }>('roles');
      expect(created).not.toBeNull();
      const roleNames = created?.roles.map((r) => r.name) ?? [];
      expect(roleNames).toEqual(['user']);
      expect(roleNames).not.toContain('admin');
    });
  });

  describe('POST /api/auth/signin', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send({
        name: 'Mateo',
        username: 'mateo',
        email: 'mateo@example.com',
        password: 'mateo12345',
      });
    });

    it('returns a JWT on valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'mateo@example.com', password: 'mateo12345' });

      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'mateo@example.com', password: 'wrong-pass' });

      expect(res.status).toBe(401);
    });

    it('returns 404 when the user does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'nobody@example.com', password: 'something1' });

      expect(res.status).toBe(404);
    });
  });
});
