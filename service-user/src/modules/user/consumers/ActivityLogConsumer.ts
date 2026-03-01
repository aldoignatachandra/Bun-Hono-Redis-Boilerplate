import { Service } from 'typedi';
import { drizzleDb } from '../../../db/connection';
import logger from '../../../helpers/logger';
import { createConsumer } from '../../../helpers/redis';
import { userActivityLogs } from '../domain/schema';

@Service()
export class ActivityLogConsumer {
  private consumer: Awaited<ReturnType<typeof createConsumer>> | null = null;

  async start() {
    try {
      this.consumer = await createConsumer('user-service-activity-logger');

      // Subscribe to all relevant topics
      // Topics must match the producers in other services:
      // - auth.events (service-auth)
      // - products.created, products.updated, products.deleted, products.restored (service-product)
      // - users.created, users.restored, users.deleted (service-user)
      await this.consumer.subscribe({
        topics: [
          'auth.events',
          'products.created',
          'products.updated',
          'products.deleted',
          'products.restored',
          'users.created',
          'users.restored',
          'users.deleted',
        ],
        fromBeginning: false,
      });

      logger.info(
        'ActivityLogConsumer started, listening to topics: auth.events, products.*, users.*'
      );

      await this.consumer.run({
        eachMessage: async ({ topic, partition: _partition, message }) => {
          try {
            const value = message.value?.toString();
            if (!value) return;

            const payload = JSON.parse(value);
            const { data, metadata } = payload;

            // Extract event type from metadata or topic
            const action = metadata?.eventType || topic;

            // Determine User ID (Best Effort Strategy)
            // 1. Explicit userId in data
            // 2. id in data (if it's a user event)
            // 3. ownerId in data (if it's a product event)
            // 4. sub in data (JWT payload style)
            let userId = data.userId || data.ownerId || data.sub;

            // Special case for User events where data.id IS the userId
            if (topic.startsWith('users.') || action.startsWith('user.')) {
              userId = userId || data.id;
            }

            if (!userId) {
              logger.warn(`Skipping activity log for ${action}: No userId found in payload`, {
                payload,
              });
              return;
            }

            // Extract extra metadata if available
            const ipAddress = data.ipAddress || metadata?.ipAddress;
            const userAgent = data.userAgent || metadata?.userAgent;

            await drizzleDb.insert(userActivityLogs).values({
              userId: userId,
              action: action,
              entityId: data.id || null, // The primary entity ID (product ID, user ID, etc.)
              details: payload, // Store full payload for detailed history
              ipAddress: ipAddress,
              userAgent: userAgent,
            });

            logger.info(`Logged activity: ${action} for user ${userId}`);
          } catch (error) {
            logger.error('Error processing activity log message:', { error, topic });
          }
        },
      });
    } catch (error) {
      console.log('Failed to create ActivityLogConsumer:', error);
      logger.error('Failed to start ActivityLogConsumer:', error);
    }
  }

  async stop() {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }
}
