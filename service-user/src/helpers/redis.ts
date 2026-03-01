import { Redis } from 'ioredis';
import { configLoader } from '../config/loader';

type ProducerSendInput = {
  topic: string;
  messages: Array<{
    key?: string;
    value: string;
    headers?: Record<string, string>;
    timestamp?: string;
  }>;
  acks?: number;
  timeout?: number;
};

type Producer = {
  send: (input: ProducerSendInput) => Promise<Array<{ stream: string; id: string }>>;
  disconnect: () => Promise<void>;
};

type ConsumerRunInput = {
  eachMessage: (payload: {
    topic: string;
    partition: number;
    message: { value: Buffer; offset: string };
  }) => Promise<void>;
};

type Consumer = {
  subscribe: (input: { topics: string[]; fromBeginning?: boolean }) => Promise<void>;
  run: (input: ConsumerRunInput) => Promise<void>;
  disconnect: () => Promise<void>;
};

let redisClient: Redis | null = null;

const createNewRedisClient = () => {
  const config = configLoader.getConfig().redis;
  // Force 127.0.0.1 if localhost to avoid IPv6 issues
  const host = config.host === 'localhost' ? '127.0.0.1' : config.host;

  return new Redis({
    host,
    port: config.port,
    password: config.password || undefined,
    db: config.db,
    keyPrefix: config.keyPrefix,
    retryStrategy: times => Math.min(times * 50, 2000),
    family: 4, // Force IPv4
    commandTimeout: 10000, // Must be greater than stream blockMs (5000)
    keepAlive: 1000, // Keep connection alive (1s)
    noDelay: true, // Disable Nagle's algorithm
  });
};

export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createNewRedisClient();
  }
  return redisClient;
};

export async function createProducer(): Promise<Producer> {
  const client = getRedisClient();
  const maxLen = configLoader.getConfig().redis.streams.maxLen;

  return {
    send: async ({ topic, messages }) => {
      const results: Array<{ stream: string; id: string }> = [];
      for (const message of messages) {
        const id = await client.xadd(topic, 'MAXLEN', '~', maxLen, '*', 'payload', message.value);
        results.push({ stream: topic, id });
      }
      return results;
    },
    disconnect: async () => {},
  };
}

export async function createConsumer(groupId: string): Promise<Consumer> {
  // Use a dedicated connection for consumer to avoid blocking the shared connection with XREADGROUP BLOCK
  const client = createNewRedisClient();
  const blockMs = configLoader.getConfig().redis.streams.blockMs;
  const consumerName = `consumer-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  let topics: string[] = [];
  let running = false;
  let startId = '$';

  return {
    subscribe: async ({ topics: newTopics, fromBeginning }) => {
      topics = newTopics;
      startId = fromBeginning ? '0-0' : '$';
      for (const topic of topics) {
        try {
          // MKSTREAM option creates the stream if it doesn't exist
          await client.xgroup('CREATE', topic, groupId, startId, 'MKSTREAM');
        } catch (error: any) {
          // Ignore BUSYGROUP error (group already exists)
          if (!error?.message?.includes('BUSYGROUP')) {
            throw error;
          }
        }
      }
    },
    run: async ({ eachMessage }) => {
      running = true;
      while (running) {
        try {
          const ids = topics.map(() => '>');
          const response = (await client.xreadgroup(
            'GROUP',
            groupId,
            consumerName,
            'BLOCK',
            blockMs,
            'STREAMS',
            ...topics,
            ...ids
          )) as [string, [string, string[]][]][];

          if (response) {
            for (const [topic, messages] of response) {
              for (const [id, fields] of messages) {
                const index = fields.indexOf('payload');
                if (index === -1) {
                  await client.xack(topic, groupId, id);
                  continue;
                }
                const payload = fields[index + 1];
                await eachMessage({
                  topic,
                  partition: 0,
                  message: { value: Buffer.from(payload), offset: id },
                });
                await client.xack(topic, groupId, id);
              }
            }
          }
        } catch (error) {
          if (running) {
            console.error('Error in consumer loop:', error);
            // Wait a bit before retrying to avoid tight loop on error
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    },
    disconnect: async () => {
      running = false;
      await client.quit();
    },
  };
}

export async function initializeRedisStreams() {
  getRedisClient();
}
