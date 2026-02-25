import { config } from 'dotenv';
import postgres from 'postgres';
import logger from '../helpers/logger';

// Load environment variables
config({ path: '.env' });

/**
 * Robust database drop script
 * Handles:
 * 1. Connecting to maintenance database
 * 2. Checking if target database exists
 * 3. Forcefully terminating active connections
 * 4. Dropping database
 * 5. Graceful error handling and logging
 */
export async function dropDatabase() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    logger.error('❌ DB_URL not found in environment variables');
    process.exit(1);
  }

  // Parse the connection string to get the database name
  let urlParts: URL;
  try {
    urlParts = new URL(dbUrl);
  } catch (error) {
    logger.error('❌ Invalid DB_URL format', { error });
    process.exit(1);
  }

  const dbName = urlParts.pathname.substring(1); // Remove leading slash

  if (!dbName) {
    logger.error('❌ Database name not found in connection string');
    process.exit(1);
  }

  // Create a connection string for the maintenance database
  const maintenanceUrl = `${urlParts.protocol}//${urlParts.username}:${urlParts.password}@${urlParts.host}/postgres`;

  logger.warn(`⚠️  Attempting to drop database: ${dbName}`);

  const sql = postgres(maintenanceUrl, { max: 1 });

  try {
    // Check if database exists
    const result = await sql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    if (result.length > 0) {
      logger.info(`ℹ️  Database '${dbName}' exists. Terminating connections...`);

      // Force drop by terminating connections first
      // This prevents "database is being accessed by other users" error
      await sql`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = ${dbName}
        AND pid <> pg_backend_pid()
      `;

      logger.info(`🔥 Dropping database '${dbName}'...`);
      await sql.unsafe(`DROP DATABASE "${dbName}"`);
      logger.info(`✅ Database '${dbName}' dropped successfully!`);
    } else {
      logger.warn(`ℹ️  Database '${dbName}' does not exist. Nothing to drop.`);
    }
  } catch (error) {
    logger.error('❌ Failed to drop database', { error });
    process.exit(1);
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  dropDatabase();
}
