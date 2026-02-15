import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Container } from 'typedi';
import { configLoader } from './config/loader';
import { checkDatabaseHealth, drizzleDb } from './db/connection';
import { errorResponse, successResponse } from './helpers/api-response';
import { systemAuthMiddleware } from './middlewares/system-auth';
import userRoutes from './modules/user/handlers/user';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Initialize dependency injection container
Container.set({
  global: true,
});

// Initialize database connection
const db = drizzleDb;
Container.set('db', db);

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
