import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { appConfig } from './config';
import { NotFoundError, ApiResponse } from './core';
import { requestIdMiddleware, errorMiddleware } from './shared';
import { healthRoutes } from './modules';

export function createApp(): Application {
  const app: Application = express();

  // Security and baseline middlewares
  app.use(helmet());
  app.use(
    cors({
      origin: appConfig.corsOrigin,
      credentials: true,
    }),
  );
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Root health probe
  app.use('/healthz', healthRoutes);

  // API router v1
  const apiRouter = express.Router();
  apiRouter.get('/', (_req: Request, res: Response) => {
    ApiResponse.success(
      res,
      {
        name: appConfig.name,
        version: '1.0.0',
        environment: appConfig.env,
      },
      'Backend Starter Kit API is operational',
    );
  });

  app.use(appConfig.apiPrefix, apiRouter);

  // 404 Catch-all handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Global Error Handler
  app.use(errorMiddleware);

  return app;
}
