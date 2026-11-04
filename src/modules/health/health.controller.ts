import { Request, Response } from 'express';
import { ApiResponse } from '../../core';
import { env } from '../../config';
import { isMongoDBConnected, isRedisConnected, isKafkaConfigured } from '../../infrastructure';

export class HealthController {
  /**
   * General service health overview.
   */
  static getHealth(_req: Request, res: Response): void {
    const isDbConnected = isMongoDBConnected();
    const isCacheConnected = isRedisConnected();
    const isKafkaSet = isKafkaConfigured();
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
          kafka: isKafkaSet ? 'configured' : 'unconfigured',
        },
      },
      'Service health report',
      isHealthy ? 200 : 503,
    );
  }

  /**
   * Kubernetes Liveness Probe (/live).
   * Verifies that the Node.js process is active and responsive.
   * Does NOT check external databases or message brokers to avoid cascading container restart loops.
   */
  static getLiveness(_req: Request, res: Response): void {
    const memory = process.memoryUsage();

    ApiResponse.success(
      res,
      {
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
          rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
          heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
          heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        },
      },
      'Liveness probe check passed',
      200,
    );
  }

  /**
   * Kubernetes Readiness Probe (/ready).
   * Verifies whether the service is ready to receive and process traffic.
   */
  static getReadiness(_req: Request, res: Response): void {
    const isDbConnected = isMongoDBConnected();
    const isCacheConnected = isRedisConnected();
    const isKafkaSet = isKafkaConfigured();

    const isReady = env.NODE_ENV === 'test' ? true : isDbConnected;

    const data = {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      dependencies: {
        database: isDbConnected ? 'ready' : 'unavailable',
        redis: isCacheConnected ? 'ready' : 'unavailable',
        kafka: isKafkaSet ? 'configured' : 'optional',
      },
    };

    if (isReady) {
      ApiResponse.success(res, data, 'Service is ready to accept traffic', 200);
    } else {
      ApiResponse.error(
        res,
        'Service is not ready to accept traffic',
        503,
        'SERVICE_UNAVAILABLE',
        data,
      );
    }
  }
}
