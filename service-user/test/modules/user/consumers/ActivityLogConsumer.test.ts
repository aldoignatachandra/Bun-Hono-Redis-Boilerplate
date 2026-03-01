import { describe, expect, it, mock } from 'bun:test';
import { ActivityLogConsumer } from '../../../../src/modules/user/consumers/ActivityLogConsumer';

const subscribe = mock(async () => undefined);
const run = mock(async (_opts: unknown) => undefined);
const disconnect = mock(async () => undefined);

mock.module('../../../../src/helpers/redis', () => ({
  createConsumer: mock(async () => ({
    subscribe,
    run,
    disconnect,
  })),
}));

describe('ActivityLogConsumer', () => {
  it('starts and subscribes to topics', async () => {
    const consumer = new ActivityLogConsumer();
    await consumer.start();
    expect(subscribe).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });

  it('stops and disconnects', async () => {
    const consumer = new ActivityLogConsumer();
    await consumer.start();
    await consumer.stop();
    expect(disconnect).toHaveBeenCalled();
  });
});
