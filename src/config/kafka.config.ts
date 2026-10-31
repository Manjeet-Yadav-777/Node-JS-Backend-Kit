export const kafkaConfig = {
  clientId: 'backend-core',
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
} as const;
