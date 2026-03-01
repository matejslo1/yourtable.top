import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { Prisma } from '@prisma/client';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  // Log the error
  if (!(err instanceof AppError) || err.statusCode >= 500) {
    console.error('[Error]', err);
  }

  // Known application errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.constructor.name,
      message: err.message,
      statusCode: err.statusCode,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') || 'field';
      res.status(409).json({
        error: 'ConflictError',
        message: `A record with this ${target} already exists`,
        statusCode: 409,
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        error: 'NotFoundError',
        message: 'Record not found',
        statusCode: 404,
      });
      return;
    }
  }

  // Unknown errors
  res.status(500).json({
    error: 'InternalServerError',
    message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
    statusCode: 500,
  });
}
