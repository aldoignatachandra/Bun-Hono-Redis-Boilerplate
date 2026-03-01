import { swaggerUI } from '@hono/swagger-ui';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { configLoader } from './config/loader';
import { checkDatabaseHealth } from './db/connection';
import { errorResponse, successResponse } from './helpers/api-response';
import { auth } from './middlewares/auth';
import { basicAuthMiddleware } from './middlewares/basic-auth';
import { rateLimiter } from './middlewares/rate-limit';
import { systemAuthMiddleware } from './middlewares/system-auth';
import { loginHandler, logoutHandler } from './modules/auth/handlers/auth';
import { getOpenApiSpec } from './openapi';

const app = new Hono();

// Auth routes rate limits
const rateLimits = {
  login: { maxRequests: 10, windowSeconds: 60 },
  logout: { maxRequests: 30, windowSeconds: 60 },
};

// Middleware
app.use('*', cors());
app.use('*', logger());

// OpenAPI documentation
app.get('/docs/openapi.json', c => c.json(getOpenApiSpec()));
app.get('/docs', swaggerUI({ url: '/docs/openapi.json' }));

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

export default app;
