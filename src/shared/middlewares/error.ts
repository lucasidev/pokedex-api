import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../infra/logger.js';
import { AppError } from '../utils/errors.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'Not Found', `Route not found: ${req.method} ${req.path}`));
};

interface MongoDuplicateKeyError {
  name: string;
  code: number;
  keyValue?: Record<string, unknown>;
}

function isMongoDuplicateKey(err: unknown): err is MongoDuplicateKeyError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'MongoServerError' &&
    (err as { code?: unknown }).code === 11000
  );
}

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

  if (isMongoDuplicateKey(err)) {
    const field = err.keyValue ? Object.keys(err.keyValue)[0] : undefined;
    const message = field ? `${field} already exists` : 'Duplicate key';
    logger.warn({ keyValue: err.keyValue, path: req.path, method: req.method }, 'duplicate key');
    res.status(409).json({
      status: 'Conflict',
      code: 409,
      message,
      ...(field ? { details: { field } } : {}),
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
