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
    // Always emit route templates (e.g. /api/users/:id), never the raw path.
    // Falling back to req.path lets ObjectIds explode Prometheus cardinality.
    const routeTemplate = req.route?.path ? `${req.baseUrl ?? ''}${req.route.path}` : '<unmatched>';
    const labels = {
      method: req.method,
      route: routeTemplate,
      status_code: String(res.statusCode),
    };
    httpRequestsTotal.inc(labels);
    httpRequestDurationSeconds.observe(labels, durationSeconds);
  });

  next();
};
