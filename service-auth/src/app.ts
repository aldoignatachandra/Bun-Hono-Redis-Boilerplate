import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { configLoader } from './config/loader';
import { successResponse } from './helpers/api-response';
import { auth } from './middlewares/auth';
import { basicAuthMiddleware } from './middlewares/basic-auth';
import { systemAuthMiddleware } from './middlewares/system-auth';
import { loginHandler, logoutHandler } from './modules/auth/handlers/auth';

const app = new Hono();

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
app.post('/auth/login', basicAuthMiddleware, loginHandler);

// Logout: Protected by JWT Auth Middleware (validates session token)
app.post('/auth/logout', auth, logoutHandler);

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
