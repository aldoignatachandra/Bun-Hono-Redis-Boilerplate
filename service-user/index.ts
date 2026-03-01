import 'reflect-metadata';
import { Container } from 'typedi';
import app from './src/app';
import { configLoader } from './src/config/loader';
import logger from './src/helpers/logger';
import { initializeRedisStreams } from './src/helpers/redis';
import { ActivityLogConsumer } from './src/modules/user/consumers/ActivityLogConsumer';

const port = configLoader.getConfig().services.userService.port;

await initializeRedisStreams();

// Start Activity Log Consumer
const startConsumer = async (retries = 5, delay = 2000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const activityLogConsumer = Container.get(ActivityLogConsumer);
      await activityLogConsumer.start();
      return;
    } catch (error) {
      logger.error(`Failed to start Activity Log Consumer (attempt ${i + 1}/${retries}):`, error);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  logger.error('Failed to start Activity Log Consumer after multiple attempts');
};

startConsumer();

Bun.serve({
  port,
  fetch: app.fetch,
});

logger.info(`User service running on http://localhost:${port}`);
