import { Router } from 'express';
import { metricsRegistry } from '../shared/metrics.js';
import { asyncHandler } from '../shared/utils/asyncHandler.js';

const router = Router();

router.get(
  '/metrics',
  asyncHandler(async (_req, res) => {
    res.setHeader('Content-Type', metricsRegistry.contentType);
    res.send(await metricsRegistry.metrics());
  }),
);

export default router;
