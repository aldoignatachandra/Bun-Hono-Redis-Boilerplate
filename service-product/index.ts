import 'reflect-metadata';
import app from './src/app';
import { configLoader } from './src/config/loader';
import './src/helpers/bun-patches'; // Suppress KafkaJS/Bun warnings
import { initializeKafkaTopics } from './src/helpers/kafka';
import logger from './src/helpers/logger';

const port = configLoader.getConfig().services.productService.port;

// Initialize Kafka topics (if configured)
// This ensures topics exist before we start consuming/producing
await initializeKafkaTopics();

Bun.serve({
  port,
  fetch: app.fetch,
});

logger.info(`Product service running on http://localhost:${port}`);
