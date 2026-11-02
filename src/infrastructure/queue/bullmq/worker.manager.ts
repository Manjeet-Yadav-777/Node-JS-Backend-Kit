import { Worker, WorkerOptions, Processor } from 'bullmq';
import { createBullMQConnection } from './connection';
import { logger } from '../../../config';

export type RegisterWorkerOptions = Omit<WorkerOptions, 'connection'>;

export class WorkerManager {
  private readonly workers = new Map<string, Worker>();

  /**
   * Registers and starts a BullMQ worker for the given queue with a dedicated connection and lifecycle event listeners.
   */
  registerWorker<DataType = unknown, ResultType = unknown, NameType extends string = string>(
    queueName: string,
    processor: Processor<DataType, ResultType, NameType>,
    options?: RegisterWorkerOptions,
  ): Worker<DataType, ResultType, NameType> {
    if (this.workers.has(queueName)) {
      throw new Error(`Worker for queue "${queueName}" is already registered`);
    }

    const connection = createBullMQConnection();
    const concurrency = options?.concurrency ?? 5;

    const worker = new Worker<DataType, ResultType, NameType>(queueName, processor, {
      ...options,
      concurrency,
      connection,
    });

    worker.on('completed', (job, result) => {
      logger.info(
        { queueName, jobId: job.id, jobName: job.name, result },
        'BullMQ job completed successfully',
      );
    });

    worker.on('failed', (job, error) => {
      logger.error(
        {
          queueName,
          jobId: job?.id,
          jobName: job?.name,
          attemptsMade: job?.attemptsMade,
          error,
        },
        'BullMQ job failed',
      );
    });

    worker.on('error', (error) => {
      logger.error({ queueName, error }, 'BullMQ worker encountered an error');
    });

    worker.on('stalled', (jobId) => {
      logger.warn({ queueName, jobId }, 'BullMQ job stalled and will be reprocessed');
    });

    this.workers.set(queueName, worker as unknown as Worker);
    logger.info({ queueName, concurrency }, 'BullMQ worker registered and started');

    return worker;
  }

  /**
   * Retrieves an active worker by its queue name.
   */
  getWorker<DataType = unknown, ResultType = unknown, NameType extends string = string>(
    queueName: string,
  ): Worker<DataType, ResultType, NameType> | undefined {
    return this.workers.get(queueName) as Worker<DataType, ResultType, NameType> | undefined;
  }

  /**
   * Gracefully closes a specific worker.
   */
  async closeWorker(queueName: string): Promise<void> {
    const worker = this.workers.get(queueName);
    if (!worker) {
      return;
    }

    try {
      await worker.close();
      this.workers.delete(queueName);
      logger.info({ queueName }, 'BullMQ worker closed gracefully');
    } catch (error) {
      logger.error({ queueName, error }, 'Error closing BullMQ worker');
      throw error;
    }
  }

  /**
   * Gracefully closes all registered workers.
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.workers.entries()).map(async ([queueName, worker]) => {
      try {
        await worker.close();
      } catch (error) {
        logger.error({ queueName, error }, 'Error closing BullMQ worker');
      }
    });

    await Promise.all(closePromises);
    this.workers.clear();
    logger.info('All BullMQ workers closed gracefully');
  }
}

export const workerManager = new WorkerManager();
