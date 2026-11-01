import { Request, Response } from 'express';
import { ApiResponse } from '../../core';
import { env } from '../../config';
import { isMongoDBConnected, isRedisConnected } from '../../infrastructure';

export class HealthController {
  static getHealth(_req: Request, res: Response): void {
    const isDbConnected = isMongoDBConnected();
    const isCacheConnected = isRedisConnected();
    const isHealthy = (isDbConnected && isCacheConnected) || env.NODE_ENV !== 'production';

    ApiResponse.success(
      res,
      {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: env.NODE_ENV,
        services: {
          database: isDbConnected ? 'connected' : 'disconnected',
          redis: isCacheConnected ? 'connected' : 'disconnected',
        },
      },
      'Service health report',
      isHealthy ? 200 : 503,
    );
  }
}
