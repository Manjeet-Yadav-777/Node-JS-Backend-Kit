import { Queue, Job, JobsOptions, BulkJobOptions } from 'bullmq';
import { createBullMQConnection } from './connection';
import { logger } from '../../../config';

export class QueueManager {
  private readonly queues = new Map<string, Queue>();

  /**
   * Retrieves an existing Queue instance or creates a new one with a dedicated BullMQ Redis connection.
   */
  getQueue<T = unknown>(queueName: string): Queue<T, unknown, string, T, unknown, string> {
    let queue = this.queues.get(queueName);
    if (!queue) {
      const connection = createBullMQConnection();
      queue = new Queue(queueName, { connection });
      this.queues.set(queueName, queue);
      logger.info({ queueName }, 'BullMQ queue initialized');
    }
    return queue as unknown as Queue<T, unknown, string, T, unknown, string>;
  }

  /**
   * Adds a single job to the specified queue with production-grade default options:
   * 3 retry attempts with exponential backoff and cleanup policies.
   */
  async addJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    opts?: JobsOptions,
  ): Promise<Job<T>> {
    const queue = this.getQueue<T>(queueName);
    const defaultOpts: JobsOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 1000,
      },
      removeOnFail: {
        count: 5000,
      },
    };

    try {
      const job = await queue.add(jobName, data, { ...defaultOpts, ...opts });
      logger.debug({ queueName, jobName, jobId: job.id }, 'Job added to BullMQ queue');
      return job;
    } catch (error) {
      logger.error({ queueName, jobName, error }, 'Failed to add job to BullMQ queue');
      throw error;
    }
  }

  /**
   * Adds multiple jobs in a single batch operation for high-throughput publishing.
   */
  async addBulkJobs<T>(
    queueName: string,
    jobs: Array<{ name: string; data: T; opts?: BulkJobOptions }>,
  ): Promise<Array<Job<T>>> {
    const queue = this.getQueue<T>(queueName);
    const defaultOpts: JobsOptions = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 1000,
      },
      removeOnFail: {
        count: 5000,
      },
    };

    const formattedJobs = jobs.map((job) => ({
      name: job.name,
      data: job.data,
      opts: { ...defaultOpts, ...job.opts },
    }));

    try {
      const createdJobs = await queue.addBulk(formattedJobs);
      logger.debug({ queueName, count: createdJobs.length }, 'Bulk jobs added to BullMQ queue');
      return createdJobs;
    } catch (error) {
      logger.error({ queueName, error }, 'Failed to add bulk jobs to BullMQ queue');
      throw error;
    }
  }

  /**
   * Gracefully closes all registered Queue instances.
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map(async (queue) => {
      try {
        await queue.close();
      } catch (error) {
        logger.error({ queueName: queue.name, error }, 'Error closing BullMQ queue');
      }
    });

    await Promise.all(closePromises);
    this.queues.clear();
    logger.info('All BullMQ queues closed gracefully');
  }
}

export const queueManager = new QueueManager();
