import { describe, expect, it, mock, spyOn } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3200';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const configPromise = import('../../src/config/loader');
const kafkaPromise = import('../../src/helpers/kafka');

describe('kafka helpers', () => {
  it('creates a producer and connects', async () => {
    const connect = mock(async () => undefined);
    const on = mock((_event: string, handler: (...args: unknown[]) => void) => {
      handler({});
      return undefined;
    });
    const producer = {
      connect,
      on,
    };

    const { kafka } = await kafkaPromise;
    const kafkaRef = kafka as unknown as {
      producer: (_options: unknown) => typeof producer;
    };
    const producerFactory = mock((_options: unknown) => producer);
    kafkaRef.producer = producerFactory;

    const kafkaModule = await kafkaPromise;
    await kafkaModule.createProducer();
    expect(connect).toHaveBeenCalled();
    expect(on).toHaveBeenCalled();
  });

  it('creates a consumer and connects', async () => {
    const connect = mock(async () => undefined);
    const on = mock((_event: string, handler: (...args: unknown[]) => void) => {
      handler({});
      return undefined;
    });
    const consumer = {
      connect,
      on,
    };

    const { kafka } = await kafkaPromise;
    const kafkaRef = kafka as unknown as {
      consumer: (_options: unknown) => typeof consumer;
    };
    const consumerFactory = mock((_options: unknown) => consumer);
    kafkaRef.consumer = consumerFactory;

    const kafkaModule = await kafkaPromise;
    await kafkaModule.createConsumer('group-id');
    expect(connect).toHaveBeenCalled();
    expect(on).toHaveBeenCalled();
  });

  it('creates an admin and connects', async () => {
    const connect = mock(async () => undefined);
    const admin = {
      connect,
    } as unknown as { connect: () => Promise<void> };

    const { kafka } = await kafkaPromise;
    const kafkaRef = kafka as unknown as {
      admin: () => typeof admin;
    };
    const adminFactory = mock(() => admin);
    kafkaRef.admin = adminFactory;

    const kafkaModule = await kafkaPromise;
    const result = await kafkaModule.createAdmin();
    expect(result as unknown).toBe(admin);
    expect(connect).toHaveBeenCalled();
  });

  it('initializes kafka topics when missing', async () => {
    const listTopics = mock(async () => [] as string[]);
    const createTopics = mock(async () => true);
    const disconnect = mock(async () => undefined);

    const admin = {
      listTopics,
      createTopics,
      disconnect,
    } as unknown as {
      listTopics: () => Promise<string[]>;
      createTopics: () => Promise<boolean>;
      disconnect: () => Promise<void>;
    };

    const kafkaModule = await kafkaPromise;
    const createAdminSpy = spyOn(kafkaModule, 'createAdmin').mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof kafkaModule.createAdmin>>
    );

    const { configLoader } = await configPromise;
    const config = configLoader.getConfig();
    const topics = {
      'test.topic': {
        partitions: 1,
        replicationFactor: 1,
        config: {},
      },
    };
    config.kafka.topics = topics;

    await kafkaModule.initializeKafkaTopics();

    expect(listTopics).toHaveBeenCalled();
    expect(createTopics).toHaveBeenCalled();

    createAdminSpy.mockRestore();
  });

  it('returns when no topics configured', async () => {
    const kafkaModule = await kafkaPromise;
    const { configLoader } = await configPromise;
    const config = configLoader.getConfig();
    config.kafka.topics = undefined;

    await kafkaModule.initializeKafkaTopics();
  });

  it('skips topic creation when all topics exist', async () => {
    const listTopics = mock(async () => ['test.topic'] as string[]);
    const createTopics = mock(async () => true);
    const disconnect = mock(async () => undefined);

    const admin = {
      listTopics,
      createTopics,
      disconnect,
    } as unknown as {
      listTopics: () => Promise<string[]>;
      createTopics: () => Promise<boolean>;
      disconnect: () => Promise<void>;
    };

    const kafkaModule = await kafkaPromise;
    const createAdminSpy = spyOn(kafkaModule, 'createAdmin').mockResolvedValue(
      admin as unknown as Awaited<ReturnType<typeof kafkaModule.createAdmin>>
    );

    const { configLoader } = await configPromise;
    const config = configLoader.getConfig();
    config.kafka.topics = {
      'test.topic': {
        partitions: 1,
        replicationFactor: 1,
        config: {},
      },
    };

    await kafkaModule.initializeKafkaTopics();

    expect(listTopics).toHaveBeenCalled();
    expect(createTopics).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();

    createAdminSpy.mockRestore();
  });
});
