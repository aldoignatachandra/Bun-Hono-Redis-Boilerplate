import { describe, expect, it, mock } from 'bun:test';

const send = mock(async () => [{ partition: 0, offset: '1' }]);
const disconnect = mock(async () => undefined);
const producer = {
  send,
  disconnect,
};

mock.module('../../../../src/helpers/redis', () => ({
  createProducer: mock(async () => producer),
}));

const modulePromise = import('../../../../src/modules/user/events/user-events');

describe('user events', () => {
  it('publishes created event', async () => {
    const { userCreatedProducer } = await modulePromise;
    await userCreatedProducer({
      id: 'u1',
      email: 'user@example.com',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(send).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('publishes deleted event', async () => {
    const { userDeletedProducer } = await modulePromise;
    await userDeletedProducer('u1', false);
    expect(send).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
