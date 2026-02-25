import { config } from 'dotenv';
import postgres from 'postgres';
import logger from '../helpers/logger';

// Load environment variables
config({ path: '.env' });

/**
 * Robust database creation script
 * Handles:
 * 1. Connecting to maintenance database (postgres)
 * 2. Checking if target database exists
 * 3. Creating database if missing
 * 4. Graceful error handling and logging
 */
export async function createDatabase() {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    logger.error('❌ DB_URL not found in environment variables');
    process.exit(1);
  }

  // Parse the connection string to get the database name
  // Format: postgresql://[user]:[password]@[host]:[port]/[database]?schema=[schema]
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

  // We need to connect to the 'postgres' database to create a new database
  // Create a connection string for the maintenance database
  const maintenanceUrl = `${urlParts.protocol}//${urlParts.username}:${urlParts.password}@${urlParts.host}/postgres`;

  logger.info(`🔍 Checking database existence: ${dbName}`);

  const sql = postgres(maintenanceUrl, { max: 1 });

  try {
    // Check if database exists
    const result = await sql`
      SELECT 1 FROM pg_database WHERE datname = ${dbName}
    `;

    if (result.length === 0) {
      logger.info(`✨ Database '${dbName}' does not exist. Creating...`);
      // CREATE DATABASE cannot be executed in a transaction block, so we use unsafe
      // Note: Parameterized queries don't work for identifiers like database names in CREATE DATABASE
      await sql.unsafe(`CREATE DATABASE "${dbName}"`);
      logger.info(`✅ Database '${dbName}' created successfully!`);
    } else {
      logger.info(`ℹ️  Database '${dbName}' already exists. Skipping creation.`);
    }
  } catch (error) {
    logger.error('❌ Failed to create database', { error });
    process.exit(1);
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  createDatabase();
}
