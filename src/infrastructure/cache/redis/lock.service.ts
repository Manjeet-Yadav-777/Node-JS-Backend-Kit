import crypto from 'crypto';
import { getRedisClient } from './connection';
import { logger } from '../../../config';
import { ConflictError } from '../../../core';

export interface LockOptions {
  ttlMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export class LockService {
  private static readonly RELEASE_LOCK_SCRIPT = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  private formatKey(resourceKey: string): string {
    return resourceKey.startsWith('lock:') ? resourceKey : `lock:${resourceKey}`;
  }

  /**
   * Attempt to acquire a distributed lock.
   * Returns a unique token string if acquired, or null if lock is held.
   */
  async acquire(resourceKey: string, ttlMs = 5000): Promise<string | null> {
    const key = this.formatKey(resourceKey);
    const token = crypto.randomUUID();

    try {
      const client = getRedisClient();
      const result = await client.set(key, token, 'PX', ttlMs, 'NX');
      return result === 'OK' ? token : null;
    } catch (error) {
      logger.error({ key, error }, 'Failed to acquire distributed lock');
      return null;
    }
  }

  /**
   * Release a distributed lock safely using an atomic Lua script.
   * Prevents deleting a lock if it was re-acquired by another process after expiration.
   */
  async release(resourceKey: string, lockToken: string): Promise<boolean> {
    const key = this.formatKey(resourceKey);

    try {
      const client = getRedisClient();
      const result = await client.eval(LockService.RELEASE_LOCK_SCRIPT, 1, key, lockToken);
      return result === 1;
    } catch (error) {
      logger.error({ key, error }, 'Failed to release distributed lock');
      return false;
    }
  }

  /**
   * Execute an asynchronous task within a distributed lock boundary.
   * Automatically handles acquisition, optional retries, and guaranteed release in a finally block.
   */
  async withLock<T>(
    resourceKey: string,
    task: () => Promise<T>,
    options: LockOptions = {},
  ): Promise<T> {
    const { ttlMs = 5000, retries = 0, retryDelayMs = 100 } = options;

    let token = await this.acquire(resourceKey, ttlMs);
    let attempts = 0;

    while (!token && attempts < retries) {
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      token = await this.acquire(resourceKey, ttlMs);
    }

    if (!token) {
      throw new ConflictError(
        `Unable to acquire distributed lock for resource: ${resourceKey}. Another operation is in progress.`,
      );
    }

    try {
      return await task();
    } finally {
      await this.release(resourceKey, token);
    }
  }
}

export const lockService = new LockService();
