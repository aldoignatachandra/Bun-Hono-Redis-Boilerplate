import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import logger from '../helpers/logger';

// Load environment variables
config({ path: '.env' });

/**
 * Robust database migration script
 * Handles:
 * 1. Connecting to target database
 * 2. Cleaning connection string (removing unsupported params like schema)
 * 3. Running migrations from ./drizzle folder
 * 4. Graceful error handling and logging
 */
export async function runMigrations() {
  const connectionString = process.env.DB_URL;
  if (!connectionString) {
    logger.error('❌ DB_URL not found in environment variables');
    process.exit(1);
  }

  logger.info('🚀 Starting database migrations...');

  // Parse connection string to handle parameters that might not be compatible with postgres.js
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch (error) {
    logger.error('❌ Invalid DB_URL format', { error });
    process.exit(1);
  }

  // Remove schema from query params as postgres.js might not support it in connection string
  // or it might conflict with options
  url.searchParams.delete('schema');

  const cleanConnectionString = url.toString();

  // Create a connection for migration
  // Note: We use max: 1 because migrations should run sequentially
  const migrationClient = postgres(cleanConnectionString, {
    max: 1,
    onnotice: () => {}, // Suppress notice messages
  });

  const db = drizzle(migrationClient);

  try {
    // This will run migrations from the ./drizzle folder
    await migrate(db, { migrationsFolder: './drizzle' });
    logger.info('✅ Migrations completed successfully!');
  } catch (error) {
    logger.error('❌ Migration failed', { error });
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

if (import.meta.main) {
  runMigrations();
}
