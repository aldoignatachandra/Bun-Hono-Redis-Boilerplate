import { describe, expect, it, mock } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
process.env.REDIS_DB = process.env.REDIS_DB ?? '0';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const xadd = mock(async () => '1-0');
const xgroup = mock(async () => 'OK');

mock.module('ioredis', () => {
  class RedisMock {
    xadd = xadd;
    xgroup = xgroup;
    xreadgroup = mock(async () => null);
    xack = mock(async () => 1);
    quit = mock(async () => 'OK');
    constructor() {}
  }
  return {
    Redis: RedisMock,
    default: RedisMock,
  };
});

describe('redis helpers', () => {
  it.skip('publishes events using streams', async () => {
    const { createProducer } = await import('../../src/helpers/redis');
    const producer = await createProducer();
    await producer.send({
      topic: 'users.created',
      messages: [{ value: JSON.stringify({ data: { id: '1' }, metadata: {} }) }],
    });
    expect(xadd).toHaveBeenCalled();
  });

  it('subscribes consumer groups', async () => {
    const { createConsumer } = await import('../../src/helpers/redis');
    const consumer = await createConsumer('test-group');
    await consumer.subscribe({ topics: ['users.created'], fromBeginning: false });
    expect(xgroup).toHaveBeenCalled();
  });

  it('initializes redis streams', async () => {
    const { initializeRedisStreams } = await import('../../src/helpers/redis');
    await initializeRedisStreams();
  });
});
