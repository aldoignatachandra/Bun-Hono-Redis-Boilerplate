import { describe, expect, it, mock } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const send = mock(async () => [{ partition: 0, offset: '1' }]);
const disconnect = mock(async () => undefined);
const producer = {
  send,
  disconnect,
};

mock.module('../../../../src/helpers/redis', () => ({
  createProducer: mock(async () => producer),
}));

const modulePromise = import('../../../../src/modules/auth/events/auth-events');

describe('auth events', () => {
  it('publishes login event', async () => {
    const { authLoginProducer } = await modulePromise;
    await authLoginProducer({
      userId: 'u1',
      email: 'a@b.com',
      role: 'USER',
      sessionId: 's1',
    });
    expect(send).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('publishes logout event', async () => {
    const { authLogoutProducer } = await modulePromise;
    await authLogoutProducer({
      userId: 'u1',
      email: 'a@b.com',
      role: 'USER',
      sessionId: 's1',
    });
    expect(send).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
