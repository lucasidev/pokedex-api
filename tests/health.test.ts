import request from 'supertest';
import app from '../src/app.js';
import { startInMemoryMongo, stopInMemoryMongo } from './helpers/testDb.js';

describe('GET /health', () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  it('returns 200 with status ok when mongo is reachable', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.uptimeSeconds).toEqual(expect.any(Number));
    expect(res.body.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'mongo', status: 'ok' })]),
    );
  });
});
