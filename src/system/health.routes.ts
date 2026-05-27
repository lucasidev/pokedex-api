import { Router } from 'express';
import { asyncHandler } from '../shared/utils/asyncHandler.js';
import { runHealthChecks } from './health.service.js';

const router = Router();

router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const report = await runHealthChecks();
    const statusCode = report.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(report);
  }),
);

export default router;
