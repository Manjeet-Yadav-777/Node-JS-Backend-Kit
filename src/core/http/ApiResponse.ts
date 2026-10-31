import { Response } from 'express';

export interface SuccessResponsePayload<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  meta?: unknown;
}

export interface ErrorResponsePayload {
  success: false;
  statusCode: number;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
}

export class ApiResponse {
  static success<T>(
    res: Response,
    data: T,
    message = 'Operation successful',
    statusCode = 200,
    meta: unknown = null,
  ): Response {
    const payload: SuccessResponsePayload<T> = {
      success: true,
      statusCode,
      message,
      data,
      meta,
    };
    return res.status(statusCode).json(payload);
  }

  static error(
    res: Response,
    message = 'An unexpected error occurred',
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: unknown,
  ): Response {
    const payload: ErrorResponsePayload = {
      success: false,
      statusCode,
      message,
      error: {
        code,
        details,
      },
    };
    return res.status(statusCode).json(payload);
  }
}
