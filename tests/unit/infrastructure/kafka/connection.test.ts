import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getKafkaClient,
  isKafkaConfigured,
  resetKafkaClient,
} from '../../../../src/infrastructure/kafka/connection';

describe('Kafka Connection Factory', () => {
  beforeEach(() => {
    resetKafkaClient();
    vi.clearAllMocks();
  });

  it('should verify that kafka is configured from environment', () => {
    expect(isKafkaConfigured()).toBe(true);
  });

  it('should return a singleton Kafka client instance', () => {
    const client1 = getKafkaClient();
    const client2 = getKafkaClient();

    expect(client1).toBeDefined();
    expect(client1).toBe(client2);
  });

  it('should allow creating a new client with custom options without overwriting singleton', () => {
    const singleton = getKafkaClient();
    const customClient = getKafkaClient({ clientId: 'custom-kafka-client' });

    expect(customClient).toBeDefined();
    expect(customClient).not.toBe(singleton);
  });

  it('should reset the singleton instance properly', () => {
    const client1 = getKafkaClient();
    resetKafkaClient();
    const client2 = getKafkaClient();

    expect(client1).not.toBe(client2);
  });
});
