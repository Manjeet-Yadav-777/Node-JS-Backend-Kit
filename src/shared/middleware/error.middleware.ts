import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ApiResponse } from '../../core';
import { logger, env } from '../../config';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.id ?? 'unknown';

  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      logger.error({ err, requestId }, `Operational Server Error: ${err.message}`);
    } else {
      logger.warn({ err, requestId }, `Client Handled Error: ${err.message}`);
    }

    ApiResponse.error(res, err.message, err.statusCode, err.errorCode, err.details);
    return;
  }

  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    logger.warn({ issues, requestId }, 'Validation failure');
    ApiResponse.error(res, 'Validation failed', 400, 'VALIDATION_ERROR', issues);
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn({ err, requestId }, 'Malformed JSON body');
    ApiResponse.error(res, 'Malformed JSON payload provided', 400, 'INVALID_JSON');
    return;
  }

  logger.error({ err, requestId }, 'Unhandled exception');

  const message =
    env.NODE_ENV === 'production'
      ? 'An internal server error occurred'
      : err instanceof Error
        ? err.message
        : 'Internal server error';

  ApiResponse.error(res, message, 500, 'INTERNAL_SERVER_ERROR');
}
