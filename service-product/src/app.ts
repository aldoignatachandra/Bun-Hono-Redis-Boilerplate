import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { Container } from 'typedi';
import { configLoader } from './config/loader';
import { checkDatabaseHealth } from './db/connection';
import { errorResponse, successResponse } from './helpers/api-response';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './helpers/errors';
import logger from './helpers/logger';
import { requestIdMiddleware } from './middlewares/request-id';
import { systemAuthMiddleware } from './middlewares/system-auth';
import productRoutes from './modules/product/handlers/product';
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
app.use('*', honoLogger());
app.use('*', requestIdMiddleware());

// OpenAPI documentation
app.get('/docs/openapi.json', c => c.json(getOpenApiSpec()));
app.get('/docs', swaggerUI({ url: '/docs/openapi.json' }));

// Initialize dependency injection container
Container.set({
  global: true,
});

// Initialize database connection
const initializeDatabase = async () => {
  try {
    const isHealthy = await checkDatabaseHealth();
    if (!isHealthy) {
      logger.error('Database connection failed');
      process.exit(1);
    }
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
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
  return successResponse(
    c,
    {
      service: 'product-service',
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

// Global error handler
app.onError(async (err, c) => {
  const requestId = c.get('requestId') || `req-${Date.now()}`;

  logger.error(
    {
      requestId,
      path: c.req.path,
      method: c.req.method,
      error: err.message,
      stack: err.stack,
    },
    'Request error'
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
