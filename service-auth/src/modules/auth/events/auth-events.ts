import logger from '../../../helpers/logger';
import { createProducer } from '../../../helpers/redis';
import { EventMetadata } from '../../../helpers/types';

export interface AuthEvent {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
}

export async function authLoginProducer(data: AuthEvent) {
  const producer = await createProducer();
  const topic = 'auth.events';

  const metadata: EventMetadata = {
    idempotencyKey: data.sessionId,
    eventType: 'auth.login',
    occurredAt: new Date().toISOString(),
    version: '1.0',
    source: 'service-auth',
  };

  try {
    const result = await producer.send({
      topic,
      messages: [
        {
          key: data.userId,
          value: JSON.stringify({
            data,
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

    logger.info('Auth login event published', {
      userId: data.userId,
      topic,
      messageId: result[0].id,
    });
  } catch (error) {
    logger.error('Failed to publish auth login event', {
      userId: data.userId,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await producer.disconnect();
  }
}

export async function authLogoutProducer(data: AuthEvent) {
  const producer = await createProducer();
  const topic = 'auth.events';

  const metadata: EventMetadata = {
    idempotencyKey: `${data.sessionId}-logout`,
    eventType: 'auth.logout',
    occurredAt: new Date().toISOString(),
    version: '1.0',
    source: 'service-auth',
  };

  try {
    const result = await producer.send({
      topic,
      messages: [
        {
          key: data.userId,
          value: JSON.stringify({
            data,
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

    logger.info('Auth logout event published', {
      userId: data.userId,
      topic,
      messageId: result[0].id,
    });
  } catch (error) {
    logger.error('Failed to publish auth logout event', {
      userId: data.userId,
      topic,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    await producer.disconnect();
  }
}
