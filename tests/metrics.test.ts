import request from 'supertest';
import app from '../src/app.js';
import { startInMemoryMongo, stopInMemoryMongo } from './helpers/testDb.js';

describe('GET /metrics', () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  });

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  it('returns Prometheus text exposition format', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('process_cpu_seconds_total');
    expect(res.text).toContain('nodejs_heap_size_total_bytes');
  });

  it('records http_requests_total after an API call', async () => {
    await request(app).get('/api');
    const res = await request(app).get('/metrics');

    expect(res.text).toMatch(/http_requests_total\{[^}]*route="\/api\/"[^}]*\}/);
  });
});
