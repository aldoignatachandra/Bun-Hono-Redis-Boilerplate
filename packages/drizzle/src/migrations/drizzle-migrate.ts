import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzleDb } from '../db/connection';

/**
 * Run pending migrations using Drizzle ORM's native migrate function
 * This integrates with drizzle-kit generated migrations
 */
export async function runMigrations() {
  console.log('🚀 Running migrations...');

  try {
    await migrate(drizzleDb as any, {
      migrationsFolder: './src/migrations',
    });

    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * CLI entry point for running migrations
 */
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration process completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration process failed:', error);
      process.exit(1);
    });
}
