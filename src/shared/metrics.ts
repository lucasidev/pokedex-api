import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();

metricsRegistry.setDefaultLabels({ service: 'pokedex-api' });
collectDefaultMetrics({ register: metricsRegistry });

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const pokeapiRequestsTotal = new Counter({
  name: 'pokeapi_requests_total',
  help: 'Total outbound requests to pokeapi.co',
  labelNames: ['status_code'] as const,
  registers: [metricsRegistry],
});

export const pokeapiRequestDurationSeconds = new Histogram({
  name: 'pokeapi_request_duration_seconds',
  help: 'PokeAPI outbound request duration in seconds',
  labelNames: ['status_code'] as const,
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const pokeapiErrorsTotal = new Counter({
  name: 'pokeapi_errors_total',
  help: 'PokeAPI request errors by kind',
  labelNames: ['kind'] as const,
  registers: [metricsRegistry],
});

export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Redis cache hits',
  labelNames: ['resource'] as const,
  registers: [metricsRegistry],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Redis cache misses',
  labelNames: ['resource'] as const,
  registers: [metricsRegistry],
});
