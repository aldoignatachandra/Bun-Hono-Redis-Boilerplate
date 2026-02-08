import app from './src/app';
import { configLoader } from './src/config/loader';
import logger from './src/helpers/logger';

const port = configLoader.getConfig().services.authService.port;

Bun.serve({
  port,
  fetch: app.fetch,
});

logger.info(`Auth service running on http://localhost:${port}`);
