import { Consumer, Kafka, logLevel, Producer } from 'kafkajs';
import { configLoader } from './config/loader';

// Kafka client configuration
export const kafka = new Kafka({
  clientId: configLoader.getConfig().kafka.clientId,
  brokers: configLoader.getConfig().kafka.brokers,
  logLevel: logLevel.INFO,
  // SSL configuration
  ssl: configLoader.getConfig().kafka.ssl
    ? {
        rejectUnauthorized: true,
      }
    : undefined,
  // SASL configuration (optional, only if username is provided)
  sasl: configLoader.getConfig().kafka.sasl?.username
    ? {
        mechanism: configLoader.getConfig().kafka.sasl?.mechanism as any,
        username: configLoader.getConfig().kafka.sasl?.username,
        password: configLoader.getConfig().kafka.sasl?.password,
      }
    : undefined,
  // Connection timeout
  requestTimeout: 30000,
  // Retry configuration
  retry: {
    initialRetryTime: 100,
    retries: 8,
  },
});

// Producer factory with optimized configuration
export async function createProducer(): Promise<Producer> {
  const producer = kafka.producer({
    // Enable idempotent producer for exactly-once semantics
    idempotent: configLoader.getConfig().kafka.producer.enableIdempotence,
    // Allow automatic topic creation for development
    allowAutoTopicCreation: configLoader.isDevelopment(),
    // Transaction configuration
    transactionTimeout: 60000,
  });

  // Event listeners
  producer.on('producer.connect', () => {
    console.log('Kafka producer connected');
  });

  producer.on('producer.disconnect', () => {
    console.warn('Kafka producer disconnected');
  });

  producer.on('producer.network.request_timeout', payload => {
    console.error('Producer request timeout', payload);
  });

  await producer.connect();
  return producer;
}

// Consumer factory with optimized configuration
export async function createConsumer(groupId: string): Promise<Consumer> {
  const consumer = kafka.consumer({
    groupId,
    // Session management
    sessionTimeout: configLoader.getConfig().kafka.consumer.sessionTimeoutMs,
    heartbeatInterval: configLoader.getConfig().kafka.consumer.heartbeatIntervalMs,
  });

  // Event listeners
  consumer.on('consumer.connect', () => {
    console.log(`Kafka consumer connected (group: ${groupId})`);
  });

  consumer.on('consumer.disconnect', () => {
    console.warn(`Kafka consumer disconnected (group: ${groupId})`);
  });

  consumer.on('consumer.group_join', payload => {
    console.log(`Consumer joined group`, { groupId });
  });

  await consumer.connect();
  return consumer;
}

// Admin client for topic management
export async function createAdmin() {
  const admin = kafka.admin();
  await admin.connect();
  return admin;
}
