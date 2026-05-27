import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../lib/logger.js';
import { AppError } from '../utils/errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'Not Found', `Route not found: ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    logger.warn(
      { statusCode: err.statusCode, code: err.code, path: req.path, method: req.method },
      err.message,
    );
    res.status(err.statusCode).json({
      status: err.code,
      code: err.statusCode,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, 'unhandled error');
  res.status(500).json({
    status: 'Internal Server Error',
    code: 500,
    message: 'An unexpected error occurred',
  });
};
