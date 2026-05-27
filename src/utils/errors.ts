export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export const BadRequest = (message: string, details?: unknown): AppError =>
  new AppError(400, 'Bad Request', message, details);

export const Unauthorized = (message = 'Unauthorized'): AppError =>
  new AppError(401, 'Unauthorized', message);

export const Forbidden = (message = 'Forbidden'): AppError =>
  new AppError(403, 'Forbidden', message);

export const NotFound = (message = 'Not Found'): AppError =>
  new AppError(404, 'Not Found', message);

export const Conflict = (message: string, details?: unknown): AppError =>
  new AppError(409, 'Conflict', message, details);

export const InternalServerError = (message = 'Internal Server Error'): AppError =>
  new AppError(500, 'Internal Server Error', message);
