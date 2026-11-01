import { getRedisClient } from './connection';
import { logger } from '../../../config';

export class CacheService {
  /**
   * Retrieve and deserialize a cached item by key.
   * Returns null if key does not exist or if cache fails (fail-open).
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = getRedisClient();
      const data = await client.get(key);
      if (data === null) {
        return null;
      }
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error({ key, error }, 'Error reading from Redis cache');
      return null;
    }
  }

  /**
   * Serialize and store an item in the cache with optional TTL in seconds.
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const client = getRedisClient();
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await client.set(key, serialized);
      }
    } catch (error) {
      logger.error({ key, error }, 'Error writing to Redis cache');
    }
  }

  /**
   * Delete one or more keys from the cache.
   */
  async del(keys: string | string[]): Promise<void> {
    try {
      const client = getRedisClient();
      const keysToDelete = Array.isArray(keys) ? keys : [keys];
      if (keysToDelete.length === 0) {
        return;
      }
      await client.del(...keysToDelete);
    } catch (error) {
      logger.error({ keys, error }, 'Error deleting from Redis cache');
    }
  }

  /**
   * Check if a key exists in the cache.
   */
  async has(key: string): Promise<boolean> {
    try {
      const client = getRedisClient();
      const exists = await client.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error({ key, error }, 'Error checking key existence in Redis cache');
      return false;
    }
  }

  /**
   * Cache-aside strategy: returns cached data if available;
   * otherwise executes factory, caches result with TTL, and returns it.
   */
  async remember<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await factory();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /**
   * Invalidate multiple keys matching a pattern using Redis SCAN.
   */
  async deleteByPattern(pattern: string): Promise<void> {
    try {
      const client = getRedisClient();
      const stream = client.scanStream({
        match: pattern,
        count: 100,
      });

      const keysToDelete: string[] = [];
      for await (const chunk of stream) {
        const keys = chunk as string[];
        if (keys.length > 0) {
          keysToDelete.push(...keys);
        }
      }

      if (keysToDelete.length > 0) {
        await client.del(...keysToDelete);
      }
    } catch (error) {
      logger.error({ pattern, error }, 'Error deleting keys by pattern from Redis cache');
    }
  }
}

export const cacheService = new CacheService();
