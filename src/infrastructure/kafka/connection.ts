import { Kafka, KafkaConfig, LogEntry, logCreator, logLevel, SASLOptions } from 'kafkajs';
import { kafkaConfig, logger } from '../../config';

let kafkaInstance: Kafka | null = null;

const toPinoLogLevel = (level: logLevel): 'error' | 'warn' | 'info' | 'debug' => {
  switch (level) {
    case logLevel.ERROR:
    case logLevel.NOTHING:
      return 'error';
    case logLevel.WARN:
      return 'warn';
    case logLevel.INFO:
      return 'info';
    case logLevel.DEBUG:
    default:
      return 'debug';
  }
};

const kafkaLogCreator: logCreator = () => {
  return (entry: LogEntry) => {
    const { message, ...extra } = entry.log;
    const pinoLevel = toPinoLogLevel(entry.level);
    logger[pinoLevel](extra, `[Kafka] ${message}`);
  };
};

function resolveSaslConfig(): SASLOptions | undefined {
  if (!kafkaConfig.sasl) {
    return undefined;
  }
  const { mechanism, username, password } = kafkaConfig.sasl;
  if (mechanism === 'scram-sha-256') {
    return { mechanism: 'scram-sha-256', username, password };
  }
  if (mechanism === 'scram-sha-512') {
    return { mechanism: 'scram-sha-512', username, password };
  }
  return { mechanism: 'plain', username, password };
}

/**
 * Returns true if Kafka brokers have been configured in the environment.
 */
export function isKafkaConfigured(): boolean {
  return kafkaConfig.brokers.length > 0;
}

/**
 * Returns a singleton Kafka instance initialized with application configurations.
 */
export function getKafkaClient(customConfig?: Partial<KafkaConfig>): Kafka {
  if (kafkaInstance && !customConfig) {
    return kafkaInstance;
  }

  const clientConfig: KafkaConfig = {
    clientId: customConfig?.clientId ?? kafkaConfig.clientId,
    brokers: customConfig?.brokers ?? [...kafkaConfig.brokers],
    ssl: customConfig?.ssl ?? (kafkaConfig.ssl ? true : undefined),
    sasl: customConfig?.sasl ?? resolveSaslConfig(),
    connectionTimeout: customConfig?.connectionTimeout ?? 5000,
    requestTimeout: customConfig?.requestTimeout ?? 30000,
    logLevel: customConfig?.logLevel ?? logLevel.INFO,
    logCreator: customConfig?.logCreator ?? kafkaLogCreator,
  };

  const client = new Kafka(clientConfig);

  if (!customConfig) {
    kafkaInstance = client;
  }

  return client;
}

/**
 * Resets the active Kafka singleton instance. Useful for unit testing.
 */
export function resetKafkaClient(): void {
  kafkaInstance = null;
}
