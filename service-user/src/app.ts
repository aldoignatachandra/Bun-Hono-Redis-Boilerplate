import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Container } from 'typedi';
import { configLoader } from './config/loader';
import { checkDatabaseHealth, drizzleDb } from './db/connection';
import { errorResponse, successResponse } from './helpers/api-response';
import { systemAuthMiddleware } from './middlewares/system-auth';
import internalRoutes from './modules/user/handlers/internal';
import userRoutes from './modules/user/handlers/user';
import { getOpenApiSpec } from './openapi';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// OpenAPI documentation
app.get('/docs/openapi.json', c => c.json(getOpenApiSpec()));
app.get('/docs', swaggerUI({ url: '/docs/openapi.json' }));

// Initialize dependency injection container
Container.set({
  global: true,
});

// Initialize database connection
const db = drizzleDb;
Container.set('db', db);

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

// Admin/System Routes (Protected by System Basic Auth)
// Must be defined BEFORE userRoutes because userRoutes captures /admin/*
app.get('/admin/health', systemAuthMiddleware, async c => {
  const dbHealth = await checkDatabaseHealth();
  return successResponse(
    c,
    {
      service: 'user-service',
      mode: 'admin',
      config: {
        db: dbHealth ? 'connected' : 'disconnected',
        kafka: 'connected', // Assuming Kafka is connected if service is running, or add check
      },
      timestamp: new Date().toISOString(),
    },
    'Admin health check passed'
  );
});

// Routes
// Internal API routes (must be before userRoutes to avoid conflicts)
app.route('/api/internal', internalRoutes);
app.route('/', userRoutes);

// Health check endpoint
app.get('/health', async c => {
  const dbHealth = await checkDatabaseHealth();
  const data = {
    service: 'user-service',
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

export default app;
