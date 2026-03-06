import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name || 'AppError',
      message: err.message,
      statusCode: err.statusCode,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.error('[ErrorHandler]', err);
  res.status(500).json({
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    statusCode: 500,
  });
}
