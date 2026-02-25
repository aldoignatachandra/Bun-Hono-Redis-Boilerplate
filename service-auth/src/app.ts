import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { configLoader } from './config/loader';
import { successResponse } from './helpers/api-response';
import { auth } from './middlewares/auth';
import { basicAuthMiddleware } from './middlewares/basic-auth';
import { rateLimiter } from './middlewares/rate-limit';
import { systemAuthMiddleware } from './middlewares/system-auth';
import { loginHandler, logoutHandler } from './modules/auth/handlers/auth';

const app = new Hono();

// Auth routes rate limits
const rateLimits = {
  login: { maxRequests: 10, windowSeconds: 60 },
  logout: { maxRequests: 30, windowSeconds: 60 },
};

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check endpoint (Public)
app.get('/health', c => {
  return successResponse(
    c,
    {
      service: 'auth-service',
      environment: configLoader.getEnvironment(),
      timestamp: new Date().toISOString(),
    },
    'Service is healthy'
  );
});

// Admin/System Routes (Protected by System Basic Auth - Env Vars)
app.get('/admin/health', systemAuthMiddleware, c => {
  return successResponse(
    c,
    {
      service: 'auth-service',
      mode: 'admin',
      config: {
        db: 'connected',
        kafka: 'connected',
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
