import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Container } from 'typedi';
import { configLoader } from './config/loader';
import { checkDatabaseHealth, drizzleDb } from './db/connection';
import { errorResponse, successResponse } from './helpers/api-response';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './helpers/errors';
import { requestIdMiddleware } from './middlewares/request-id';
import { systemAuthMiddleware } from './middlewares/system-auth';
import internalRoutes from './modules/user/handlers/internal';
import userRoutes from './modules/user/handlers/user';
import { getOpenApiSpec } from './openapi';

const app = new Hono();

// CORS configuration
// TODO: In production, set CORS_ALLOWED_ORIGINS env var to specific origins
const corsConfig = configLoader.getCorsConfig();
const corsOptions = {
  origin: (origin: string) => {
    if (corsConfig.allowedOrigins.includes('*')) {
      return origin;
    }
    if (corsConfig.allowedOrigins.includes(origin)) {
      return origin;
    }
    return origin;
  },
  credentials: corsConfig.credentials,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Correlation-ID'],
  exposeHeaders: ['X-Request-ID', 'X-Correlation-ID', 'X-Total-Count'],
  maxAge: corsConfig.maxAge,
};

// Middleware
app.use('*', cors(corsOptions));
app.use('*', logger());
app.use('*', requestIdMiddleware());

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
        redis: 'connected',
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

// Global error handler
app.onError(async (err, c) => {
  const requestId = c.get('requestId') || `req-${Date.now()}`;

  console.error(
    JSON.stringify({
      requestId,
      path: c.req.path,
      method: c.req.method,
      error: err.message,
      stack: err.stack,
    })
  );

  if (err instanceof AppError) {
    return errorResponse(c, err.message, err.code, err.status, err.details);
  }

  const message = process.env.NODE_ENV === 'development' ? err.message : 'Internal server error';

  return errorResponse(c, message, 'INTERNAL_ERROR', 500);
});

// Not found handler
app.notFound(async c => {
  return errorResponse(c, 'Resource not found', 'NOT_FOUND', 404);
});

export default app;
