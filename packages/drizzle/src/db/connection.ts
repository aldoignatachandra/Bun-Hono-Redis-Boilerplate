import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

/**
 * Database connection configuration
 * These values can be overridden via environment variables
 */
const connectionConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20'),
  connect_timeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10'),
};

/**
 * Get database URL from environment variable
 * Falls back to default PostgreSQL connection for development
 */
function getDatabaseUrl(): string {
  const dbUrl = process.env.DB_URL;

  if (!dbUrl) {
    const defaultUrl = 'postgresql://postgres:postgres@localhost:5432/cqrs_demo';
    console.warn(`DB_URL not found in environment, using default: ${defaultUrl}`);
    return defaultUrl;
  }

  return dbUrl;
}

const connectionString = getDatabaseUrl();
const client = postgres(connectionString, connectionConfig);

export const drizzleDb = drizzle(client, {
  schema,
  logger:
    process.env.NODE_ENV === 'development'
      ? {
          logQuery: (query: string, params: unknown[]) => {
            console.log('Query:', query);
            console.log('Params:', params);
          },
        }
      : false,
});

export { client };

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    await client.end();
    console.log('Database connection closed gracefully');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}
