import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { configLoader } from './config/loader';
import { checkDatabaseHealth } from './db/connection';
import { errorResponse, successResponse } from './helpers/api-response';
import { AppError } from './helpers/errors';
import logger from './helpers/logger';
import { auth } from './middlewares/auth';
import { basicAuthMiddleware } from './middlewares/basic-auth';
import { rateLimiter } from './middlewares/rate-limit';
import { requestIdMiddleware } from './middlewares/request-id';
import { systemAuthMiddleware } from './middlewares/system-auth';
import { loginHandler, logoutHandler } from './modules/auth/handlers/auth';
import { getOpenApiSpec } from './openapi';

const app = new Hono();

// Auth routes rate limits
const rateLimits = {
  login: { maxRequests: 10, windowSeconds: 60 },
  logout: { maxRequests: 30, windowSeconds: 60 },
};

// CORS configuration
// TODO: In production, set CORS_ALLOWED_ORIGINS env var to specific origins
// e.g., CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
const corsConfig = configLoader.getCorsConfig();
const corsOptions = {
  origin: (origin: string) => {
    // Allow all origins in development, or if '*' is configured
    if (corsConfig.allowedOrigins.includes('*')) {
      return origin;
    }
    // Check if origin is in allowed list
    if (corsConfig.allowedOrigins.includes(origin)) {
      return origin;
    }
    // Deny origin in production if not in allowlist
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

// Health check endpoint (Public)
app.get('/health', async c => {
  const dbHealth = await checkDatabaseHealth();
  const data = {
    service: 'auth-service',
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

// Admin/System Routes (Protected by System Basic Auth - Env Vars)
app.get('/admin/health', systemAuthMiddleware, async c => {
  const dbHealth = await checkDatabaseHealth();
  return successResponse(
    c,
    {
      service: 'auth-service',
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

// Authentication Routes

// Login: Protected by User Basic Auth Middleware (validates against DB)
app.post(
  '/auth/login',
  rateLimiter(rateLimits.login.maxRequests, rateLimits.login.windowSeconds),
  basicAuthMiddleware,
  loginHandler
);

// Logout: Protected by JWT Auth Middleware (validates session token)
app.post(
  '/auth/logout',
  auth,
  rateLimiter(rateLimits.logout.maxRequests, rateLimits.logout.windowSeconds),
  logoutHandler
);

// Gateway routes placeholder
app.get('/', c => {
  return c.json({
    message: 'Auth Service Gateway',
    services: {
      user: 'http://localhost:3101',
      product: 'http://localhost:3102',
    },
  });
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
