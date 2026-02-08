import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Container } from 'typedi';
import { configLoader } from './config/loader';
import { checkDatabaseHealth } from './db/connection';
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

  return c.json({
    status: dbHealth ? 'ok' : 'error',
    service: 'product-service',
    environment: configLoader.getEnvironment(),
    database: dbHealth ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

export default app;
