import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { isDatabaseConnected } from './config/database';
import { requestIdMiddleware } from './common/middlewares/request-id.middleware';
import { errorMiddleware } from './common/middlewares/error.middleware';
import { NotFoundError } from './common/errors/app-error';
import { ApiResponse } from './common/utils/api-response';

export function createApp(): Application {
  const app: Application = express();

  // Security and utilities
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/healthz', (_req: Request, res: Response) => {
    ApiResponse.success(
      res,
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        database: isDatabaseConnected() ? 'connected' : 'disconnected',
      },
      'Service is operational',
    );
  });

  // Base API routes placeholder
  const apiRouter = express.Router();
  apiRouter.get('/', (_req: Request, res: Response) => {
    ApiResponse.success(res, { version: '1.0.0' }, 'Backend API root');
  });

  app.use(env.API_PREFIX, apiRouter);

  // 404 Catch-all handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Global Error Handler
  app.use(errorMiddleware);

  return app;
}
