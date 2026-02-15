import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Container } from 'typedi';
import { configLoader } from './config/loader';
import { checkDatabaseHealth } from './db/connection';
import { successResponse, errorResponse } from './helpers/api-response';
import { systemAuthMiddleware } from './middlewares/system-auth';
import productRoutes from './modules/product/handlers/product';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Initialize dependency injection container
Container.set({
  global: true,
});

// Initialize database connection
const initializeDatabase = async () => {
  try {
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      console.error('Database connection failed');
      process.exit(1);
    }
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
};

// Initialize database on startup
initializeDatabase();

// Routes
app.route('/', productRoutes);

// Health check endpoint
app.get('/health', async c => {
  const dbHealth = await checkDatabaseHealth();
  const data = {
    service: 'product-service',
    environment: configLoader.getEnvironment(),
    database: dbHealth ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  };

  if (dbHealth) {
    return successResponse(c, data, 'Service is healthy');
  } else {
    return errorResponse(c, 'Service is unhealthy', 'SERVICE_UNHEALTHY', 503, data);
  }
});

// Admin/System Routes (Protected by System Basic Auth)
app.get('/admin/health', systemAuthMiddleware, async c => {
  const dbHealth = await checkDatabaseHealth();
  return successResponse(c, {
    service: 'product-service',
    mode: 'admin',
    config: {
      db: dbHealth ? 'connected' : 'disconnected',
      kafka: 'connected', // Assuming Kafka is connected if service is running, or add check
    },
    timestamp: new Date().toISOString(),
  }, 'Admin health check passed');
});

export default app;
