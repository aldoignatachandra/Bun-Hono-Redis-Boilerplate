import { createProducer } from '../../../helpers/kafka';
import logger from '../../../helpers/logger';
import { EventMetadata } from '../../../helpers/types';

export interface UserEvent {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
  updatedAt?: Date;
}

export async function userCreatedProducer(user: UserEvent) {
  const producer = await createProducer();
  const topic = 'users.created';

  const metadata: EventMetadata = {
    idempotencyKey: user.id,
    eventType: 'user.created',
    occurredAt: new Date().toISOString(),
    version: '1.0',
    source: 'user-service',
  };

  try {
    const result = await producer.send({
      topic,
      acks: -1,
      timeout: 30000,
      messages: [
        {
          key: user.id,
          value: JSON.stringify({
            data: user,
            metadata,
          }),
          headers: {
            idempotencyKey: metadata.idempotencyKey,
            eventType: metadata.eventType,
            occurredAt: metadata.occurredAt,
            version: metadata.version,
            source: metadata.source,
          },
          timestamp: Date.now().toString(),
        },
      ],
    });

    logger.info('User created event published', {
      userId: user.id,
      topic,
      partition: result[0].partition,
      offset: result[0].offset,
    });
  } catch (error) {
    logger.error('Failed to publish user created event', {
      userId: user.id,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw if event publishing fails, as user creation succeeded
  } finally {
    await producer.disconnect();
  }
}

export async function userRestoredProducer(user: UserEvent) {
  const producer = await createProducer();
  const topic = 'users.restored';

  const metadata: EventMetadata = {
    idempotencyKey: `${user.id}-restored-${Date.now()}`,
    eventType: 'user.restored',
    occurredAt: new Date().toISOString(),
    version: '1.0',
    source: 'user-service',
  };

  try {
    const result = await producer.send({
      topic,
      acks: -1,
      timeout: 30000,
      messages: [
        {
          key: user.id,
          value: JSON.stringify({
            data: user,
            metadata,
          }),
          headers: {
            idempotencyKey: metadata.idempotencyKey,
            eventType: metadata.eventType,
            occurredAt: metadata.occurredAt,
            version: metadata.version,
            source: metadata.source,
          },
          timestamp: Date.now().toString(),
        },
      ],
    });

    logger.info('User restored event published', {
      userId: user.id,
      topic,
      partition: result[0].partition,
      offset: result[0].offset,
    });
  } catch (error) {
    logger.error('Failed to publish user restored event', {
      userId: user.id,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await producer.disconnect();
  }
}

export async function userDeletedProducer(userId: string, force: boolean) {
  const producer = await createProducer();
  const topic = 'users.deleted';

  const metadata: EventMetadata = {
    idempotencyKey: `${userId}-deleted-${Date.now()}`,
    eventType: 'user.deleted',
    occurredAt: new Date().toISOString(),
    version: '1.0',
    source: 'user-service',
  };

  try {
    const result = await producer.send({
      topic,
      acks: -1,
      timeout: 30000,
      messages: [
        {
          key: userId,
          value: JSON.stringify({
            data: { id: userId, force },
            metadata,
          }),
          headers: {
            idempotencyKey: metadata.idempotencyKey,
            eventType: metadata.eventType,
            occurredAt: metadata.occurredAt,
            version: metadata.version,
            source: metadata.source,
          },
          timestamp: Date.now().toString(),
        },
      ],
    });

    logger.info('User deleted event published', {
      userId,
      topic,
      partition: result[0].partition,
      offset: result[0].offset,
    });
  } catch (error) {
    logger.error('Failed to publish user deleted event', {
      userId,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await producer.disconnect();
  }
}
