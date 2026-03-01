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

const getRedisClient = () => {
  if (!redisClient) {
    const config = configLoader.getConfig().redis;
    redisClient = new Redis({
      host: config.host,
      port: config.port,
      password: config.password || undefined,
      db: config.db,
      keyPrefix: config.keyPrefix,
      retryStrategy: times => Math.min(times * 50, 2000),
    });
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
  const client = getRedisClient();
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
          await client.xgroup('CREATE', topic, groupId, startId, 'MKSTREAM');
        } catch (error: any) {
          if (!error?.message?.includes('BUSYGROUP')) {
            throw error;
          }
        }
      }
    },
    run: async ({ eachMessage }) => {
      running = true;
      while (running) {
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
        )) as Array<[string, Array<[string, string[]]>]> | null;
        if (!response) {
          continue;
        }
        for (const [stream, messages] of response) {
          for (const [id, fields] of messages) {
            const index = fields.indexOf('payload');
            if (index === -1) {
              await client.xack(stream, groupId, id);
              continue;
            }
            const payload = fields[index + 1];
            await eachMessage({
              topic: stream,
              partition: 0,
              message: {
                value: Buffer.from(payload),
                offset: id,
              },
            });
            await client.xack(stream, groupId, id);
          }
        }
      }
    },
    disconnect: async () => {
      running = false;
    },
  };
}

export async function initializeRedisStreams() {
  getRedisClient();
}
