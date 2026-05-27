import type { RequestHandler } from 'express';
import { httpRequestDurationSeconds, httpRequestsTotal } from '../metrics.js';

const EXCLUDED_PATHS = new Set(['/metrics', '/health']);

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  if (EXCLUDED_PATHS.has(req.path)) {
    return next();
  }

  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    const durationSeconds = Number(process.hrtime.bigint() - startNs) / 1e9;
    const route = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : req.path;
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });

  next();
};
