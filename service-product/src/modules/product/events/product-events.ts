import { createProducer } from '../../../helpers/kafka';
import logger from '../../../helpers/logger';
import { EventMetadata } from '../../../helpers/types';

export interface ProductEvent {
  id: string;
  name: string;
  price: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
}

// Product created event producer
export async function productCreatedProducer(product: ProductEvent, correlationId?: string) {
  const producer = await createProducer();
  const topic = 'products.created';

  const metadata: EventMetadata = {
    idempotencyKey: product.id,
    eventType: 'product.created',
    occurredAt: new Date().toISOString(),
    version: '1.0',
    source: 'product-service',
    correlationId,
  };

  try {
    const result = await producer.send({
      topic,
      acks: -1, // Wait for all replicas
      timeout: 30000,
      messages: [
        {
          key: product.id,
          value: JSON.stringify({
            data: product,
            metadata,
          }),
          headers: {
            idempotencyKey: metadata.idempotencyKey,
            eventType: metadata.eventType,
            occurredAt: metadata.occurredAt,
            version: metadata.version,
            source: metadata.source,
            correlationId: correlationId || '',
          },
          timestamp: Date.now().toString(),
        },
      ],
    });

    logger.info('Product created event published', {
      productId: product.id,
      topic,
      partition: result[0].partition,
      offset: result[0].offset,
    });

    return result;
  } catch (error) {
    logger.error('Failed to publish product created event', {
      productId: product.id,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    await producer.disconnect();
  }
}

// Product updated event producer
export async function productUpdatedProducer(product: ProductEvent, correlationId?: string) {
  const producer = await createProducer();
  const topic = 'products.updated';

  const metadata: EventMetadata = {
    idempotencyKey: `${product.id}-${product.updatedAt.getTime()}`,
    eventType: 'product.updated',
    occurredAt: new Date().toISOString(),
    version: '1.0',
    source: 'product-service',
    correlationId,
  };

  try {
    const result = await producer.send({
      topic,
      acks: -1,
      timeout: 30000,
      messages: [
        {
          key: product.id,
          value: JSON.stringify({
            data: product,
            metadata,
          }),
          headers: {
            idempotencyKey: metadata.idempotencyKey,
            eventType: metadata.eventType,
            occurredAt: metadata.occurredAt,
            version: metadata.version,
            source: metadata.source,
            correlationId: correlationId || '',
          },
          timestamp: Date.now().toString(),
        },
      ],
    });

    logger.info('Product updated event published', {
      productId: product.id,
      topic,
      partition: result[0].partition,
      offset: result[0].offset,
    });

    return result;
  } catch (error) {
    logger.error('Failed to publish product updated event', {
      productId: product.id,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    await producer.disconnect();
  }
}

// Product deleted event producer
export async function productDeletedProducer(
  productId: string,
  ownerId: string,
  correlationId?: string
) {
  const producer = await createProducer();
  const topic = 'products.deleted';

  const metadata: EventMetadata = {
    idempotencyKey: productId,
    eventType: 'product.deleted',
    occurredAt: new Date().toISOString(),
    version: '1.0',
    source: 'product-service',
    correlationId,
  };

  try {
    const result = await producer.send({
      topic,
      acks: -1,
      timeout: 30000,
      messages: [
        {
          key: productId,
          value: JSON.stringify({
            data: {
              id: productId,
              ownerId,
            },
            metadata,
          }),
          headers: {
            idempotencyKey: metadata.idempotencyKey,
            eventType: metadata.eventType,
            occurredAt: metadata.occurredAt,
            version: metadata.version,
            source: metadata.source,
            correlationId: correlationId || '',
          },
          timestamp: Date.now().toString(),
        },
      ],
    });

    logger.info('Product deleted event published', {
      productId,
      topic,
      partition: result[0].partition,
      offset: result[0].offset,
    });

    return result;
  } catch (error) {
    logger.error('Failed to publish product deleted event', {
      productId,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    await producer.disconnect();
  }
}

// Product restored event producer
export async function productRestoredProducer(
  productId: string,
  ownerId: string,
  correlationId?: string
) {
  const producer = await createProducer();
  const topic = 'products.restored';

  const metadata: EventMetadata = {
    idempotencyKey: productId,
    eventType: 'product.restored',
    occurredAt: new Date().toISOString(),
    version: '1.0',
    source: 'product-service',
    correlationId,
  };

  try {
    const result = await producer.send({
      topic,
      acks: -1,
      timeout: 30000,
      messages: [
        {
          key: productId,
          value: JSON.stringify({
            data: {
              id: productId,
              ownerId,
            },
            metadata,
          }),
          headers: {
            idempotencyKey: metadata.idempotencyKey,
            eventType: metadata.eventType,
            occurredAt: metadata.occurredAt,
            version: metadata.version,
            source: metadata.source,
            correlationId: correlationId || '',
          },
          timestamp: Date.now().toString(),
        },
      ],
    });

    logger.info('Product restored event published', {
      productId,
      topic,
      partition: result[0].partition,
      offset: result[0].offset,
    });

    return result;
  } catch (error) {
    logger.error('Failed to publish product restored event', {
      productId,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    await producer.disconnect();
  }
}
