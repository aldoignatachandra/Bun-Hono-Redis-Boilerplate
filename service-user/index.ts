import { Container } from 'typedi';
import app from './src/app';
import { configLoader } from './src/config/loader';
import { initializeKafkaTopics } from './src/helpers/kafka';
import logger from './src/helpers/logger';
import { ActivityLogConsumer } from './src/modules/user/consumers/ActivityLogConsumer';

const port = configLoader.getConfig().services.userService.port;

// Initialize Kafka topics (if configured)
// This ensures topics exist before we start consuming/producing
await initializeKafkaTopics();

// Start Activity Log Consumer
try {
  const activityLogConsumer = Container.get(ActivityLogConsumer);
  await activityLogConsumer.start();
} catch (error) {
  logger.error('Failed to start Activity Log Consumer:', error);
}

Bun.serve({
  port,
  fetch: app.fetch,
});

logger.info(`User service running on http://localhost:${port}`);
