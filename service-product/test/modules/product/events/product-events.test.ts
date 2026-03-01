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

const modulePromise = import('../../../../src/modules/product/events/product-events');

describe('product events', () => {
  it('publishes created event', async () => {
    const { productCreatedProducer } = await modulePromise;
    await productCreatedProducer({
      id: 'p1',
      name: 'Item',
      price: 10,
      ownerId: 'o1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(send).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('publishes deleted event', async () => {
    const { productDeletedProducer } = await modulePromise;
    await productDeletedProducer('p1', 'o1');
    expect(send).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('publishes updated event', async () => {
    const { productUpdatedProducer } = await modulePromise;
    await productUpdatedProducer({
      id: 'p1',
      name: 'Updated',
      price: 12,
      ownerId: 'o1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(send).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('publishes restored event', async () => {
    const { productRestoredProducer } = await modulePromise;
    await productRestoredProducer('p1', 'o1');
    expect(send).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
