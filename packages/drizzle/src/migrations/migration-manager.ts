import { randomUUID } from 'crypto';
import { client } from '../db/connection';
import {
  MigrationBatchResult,
  MigrationContext,
  MigrationExecutionContext,
  MigrationOptions,
  MigrationResult,
} from './types';
import {
  createMigrationDirectory,
  formatExecutionTime,
  generateMigrationTemplate,
  getMigrationDirectories,
  loadMigrationFile,
  splitSQLStatements,
} from './utils';

/**
 * Simplified Drizzle Migration Manager
 * Handles basic migration creation and application
 */
export class DrizzleMigrationManager {
  private migrationsPath: string;

  constructor(migrationsPath: string = './src/migrations') {
    this.migrationsPath = migrationsPath;
  }

  /**
   * Create a new migration
   */
  async createMigration(options: MigrationOptions = {}): Promise<string> {
    const { name, createOnly = false } = options;

    if (!name) {
      throw new Error('Migration name is required. Use --name flag to specify migration name.');
    }

    console.log(`🔄 Creating migration: ${name}`);

    try {
      // Generate migration template
      const { up, down } = generateMigrationTemplate(name);

      // Create migration directory and files
      const migrationDir = createMigrationDirectory(this.migrationsPath, name, up, down);

      console.log(`✅ Migration ${migrationDir} created with migration.sql and down.sql`);

      if (!createOnly) {
        console.log('📝 Applying migration to database...');

        // Apply migration immediately
        const result = await this.applyMigration(migrationDir);

        if (result.success) {
          console.log(
            `✅ Migration ${migrationDir} applied successfully in ${formatExecutionTime(result.executionTime)}`
          );
        } else {
          console.error(`❌ Failed to apply migration: ${result.error}`);
          throw new Error(result.error);
        }
      }

      return migrationDir;
    } catch (error) {
      console.error(`❌ Failed to create migration:`, error);
      throw error;
    }
  }

  /**
   * Apply pending migrations
   */
  async migrateUp(options: MigrationOptions = {}): Promise<MigrationBatchResult> {
    const { dryRun = false } = options;

    console.log('🚀 Applying migrations...');

    try {
      // Get all migration directories
      const migrationDirs = getMigrationDirectories(this.migrationsPath);

      if (migrationDirs.length === 0) {
        console.log('ℹ️ No migrations to apply');
        return {
          batchId: randomUUID(),
          migrations: [],
          totalExecutionTime: 0,
          success: true,
          startedAt: new Date(),
          finishedAt: new Date(),
        };
      }

      // Create batch context
      const batchId = randomUUID();
      const context: MigrationContext = {
        environment: process.env.NODE_ENV || 'unknown',
        batchId,
        dryRun: dryRun || false,
        force: false,
      };

      const startTime = Date.now();
      const results: MigrationResult[] = [];

      // Apply migrations in order
      for (const migrationDir of migrationDirs) {
        const result = await this.applyMigration(migrationDir, context);
        results.push(result);

        if (!result.success) {
          console.error(`💥 Migration failed. Stopping execution.`);
          break;
        }
      }

      const totalExecutionTime = Date.now() - startTime;

      return {
        batchId,
        migrations: results,
        totalExecutionTime,
        success: results.every(r => r.success),
        startedAt: new Date(startTime),
        finishedAt: new Date(),
      };
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Apply a single migration
   */
  private async applyMigration(
    migrationDir: string,
    context?: Partial<MigrationContext>
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const migrationName = migrationDir;

    try {
      // Load migration file
      const migrationFile = loadMigrationFile(this.migrationsPath, migrationDir);

      // Create execution context
      const executionContext: MigrationExecutionContext = {
        environment: context?.environment || process.env.NODE_ENV || 'unknown',
        batchId: context?.batchId || randomUUID(),
        dryRun: context?.dryRun || false,
        force: context?.force || false,
        migrationName,
        version: migrationFile.metadata.version,
        sql: migrationFile.sql,
        checksum: '', // Simplified - no checksum tracking
      };

      console.log(`📝 Applying migration: ${migrationDir}`);

      if (executionContext.dryRun) {
        console.log(`🔍 DRY RUN: Would execute migration ${migrationDir}`);
        return {
          migrationName,
          success: true,
          executionTime: Date.now() - startTime,
          appliedAt: new Date(),
        };
      }

      // Split SQL into statements and execute
      const statements = splitSQLStatements(migrationFile.sql);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(
          `🔍 Executing SQL ${i + 1}/${statements.length}: ${statement.substring(0, 100)}...`
        );

        try {
          await client`EXECUTE ${statement}`;
        } catch (error: any) {
          // Check if this is an "already exists" error that we can ignore
          const errorMessage = error?.message || '';
          const isDuplicateError =
            errorMessage.includes('already exists') ||
            errorMessage.includes('duplicate key') ||
            errorMessage.includes('relation');

          if (isDuplicateError) {
            console.log(`⚠️  Object already exists, continuing...`);
          } else {
            throw error;
          }
        }
      }

      const executionTime = Date.now() - startTime;

      console.log(
        `✅ Migration ${migrationDir} completed successfully (${formatExecutionTime(executionTime)})`
      );

      return {
        migrationName,
        success: true,
        executionTime,
        appliedAt: new Date(),
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`❌ Migration ${migrationDir} failed:`, error);

      return {
        migrationName,
        success: false,
        executionTime,
        error: errorMessage,
      };
    }
  }
}

// CLI execution
async function main() {
  const command = process.argv[2];
  const manager = new DrizzleMigrationManager();

  try {
    switch (command) {
      case 'create': {
        const name = process.argv.find(arg => arg.startsWith('--name='))?.split('=')[1];
        const createOnly = process.argv.includes('--create-only');
        await manager.createMigration({ name, createOnly });
        break;
      }

      case 'up': {
        const dryRun = process.argv.includes('--dry-run');
        await manager.migrateUp({ dryRun });
        break;
      }

      default:
        console.log(`
Usage: tsx migration-manager.ts [command] [options]

Commands:
  create --name=<migration_name> [--create-only]  Create a new migration
  up [--dry-run]                                     Apply pending migrations

Examples:
  tsx migration-manager.ts create --name=add_user_table
  tsx migration-manager.ts up
        `);
        break;
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
