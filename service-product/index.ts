import 'reflect-metadata';
import app from './src/app';
import { configLoader } from './src/config/loader';
import logger from './src/helpers/logger';
import { initializeRedisStreams } from './src/helpers/redis';

const port = configLoader.getConfig().services.productService.port;

await initializeRedisStreams();

Bun.serve({
  port,
  fetch: app.fetch,
});

logger.info(`Product service running on http://localhost:${port}`);
