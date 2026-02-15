import { Consumer, Kafka, logLevel, Producer, Partitioners } from 'kafkajs';
import { configLoader } from '../config/loader';

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
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

// Producer factory with optimized configuration
export async function createProducer(): Promise<Producer> {
  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner,
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

  producer.on('producer.network.request_timeout', _payload => {
    console.error('Producer request timeout');
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

  consumer.on('consumer.group_join', _payload => {
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

// Initialize Kafka topics based on configuration
export async function initializeKafkaTopics() {
  const config = configLoader.getConfig();
  if (!config.kafka.topics) {
    console.log('No Kafka topics configured to initialize');
    return;
  }

  try {
    const admin = await createAdmin();
    const existingTopics = await admin.listTopics();
    const topicsToCreate: any[] = [];

    console.log('Checking Kafka topics...');

    for (const [topicName, topicConfig] of Object.entries(config.kafka.topics)) {
      if (!existingTopics.includes(topicName)) {
        console.log(`Queueing topic creation: ${topicName}`);
        topicsToCreate.push({
          topic: topicName,
          numPartitions: topicConfig.partitions,
          replicationFactor: topicConfig.replicationFactor,
          configEntries: Object.entries(topicConfig.config || {}).map(([name, value]) => ({
            name,
            value: String(value),
          })),
        });
      }
    }

    if (topicsToCreate.length > 0) {
      console.log(`Creating ${topicsToCreate.length} Kafka topics...`);
      await admin.createTopics({
        topics: topicsToCreate,
        waitForLeaders: true,
      });
      console.log('Kafka topics created successfully');
    } else {
      console.log('All configured Kafka topics already exist');
    }

    await admin.disconnect();
  } catch (error) {
    console.error('Failed to initialize Kafka topics:', error);
    // Don't throw, just log error so app can continue if Kafka is temporarily down
    // (unless strict mode is needed)
  }
}
