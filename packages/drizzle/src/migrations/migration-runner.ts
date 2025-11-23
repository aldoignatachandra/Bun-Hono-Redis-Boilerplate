import { randomUUID } from 'crypto';
import { client } from '../db/connection';
import { MigrationBatchResult, MigrationExecutionContext, MigrationResult } from './types';
import {
  formatExecutionTime,
  getMigrationDirectories,
  loadMigrationFile,
  splitSQLStatements,
} from './utils';

/**
 * Simplified Drizzle Migration Runner
 * Handles basic migration execution
 */
export class DrizzleMigrationRunner {
  private migrationsPath: string;

  constructor(migrationsPath: string = './src/migrations') {
    this.migrationsPath = migrationsPath;
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(
    options: {
      environment?: string;
      dryRun?: boolean;
      force?: boolean;
      batchId?: string;
    } = {}
  ): Promise<MigrationBatchResult> {
    const {
      environment = process.env.NODE_ENV,
      dryRun = false,
      force = false,
      batchId = randomUUID(),
    } = options;

    console.log('🚀 Starting migration runner...');

    try {
      // Get all migration directories
      const migrationDirs = getMigrationDirectories(this.migrationsPath);

      if (migrationDirs.length === 0) {
        console.log('ℹ️ No migrations found');
        return {
          batchId,
          migrations: [],
          totalExecutionTime: 0,
          success: true,
          startedAt: new Date(),
          finishedAt: new Date(),
        };
      }

      // Execute migrations
      const startTime = Date.now();
      const results: MigrationResult[] = [];

      for (const migrationDir of migrationDirs) {
        const result = await this.executeMigration(migrationDir, {
          environment,
          batchId,
          dryRun,
          force,
        });
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
      console.error('❌ Migration runner failed:', error);
      throw error;
    }
  }

  /**
   * Execute a single migration
   */
  async executeMigration(
    migrationDir: string,
    context: Partial<MigrationExecutionContext> = {}
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    const migrationName = migrationDir;

    try {
      // Load migration file
      const migrationFile = loadMigrationFile(this.migrationsPath, migrationDir);

      // Create execution context
      const executionContext: MigrationExecutionContext = {
        environment: context.environment || process.env.NODE_ENV || 'unknown',
        batchId: context.batchId || randomUUID(),
        dryRun: context.dryRun || false,
        force: context.force || false,
        migrationName,
        version: migrationFile.metadata.version,
        sql: migrationFile.sql,
        checksum: '', // Simplified - no checksum tracking
      };

      console.log(`\n🔄 Executing migration: ${migrationDir}`);

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

      console.log(`📝 Executing ${statements.length} SQL statements for ${migrationDir}`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(
          `🔍 Executing SQL ${i + 1}/${statements.length}: ${statement.substring(0, 100)}...`
        );

        try {
          await client`${statement}`;
        } catch (error: any) {
          // Check if this is an "already exists" error that we can ignore
          const errorCode = error?.code || error?.meta?.code;
          const errorMessage = error?.message || '';
          const isDuplicateError =
            errorCode === '42P07' || // relation already exists
            errorCode === '42710' || // type already exists
            errorCode === 'P2002' || // unique constraint
            errorMessage.includes('already exists');

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
  const runner = new DrizzleMigrationRunner();

  try {
    switch (command) {
      case 'run': {
        const dryRun = process.argv.includes('--dry-run');
        const force = process.argv.includes('--force');
        await runner.runMigrations({ dryRun, force });
        break;
      }

      default:
        console.log(`
Usage: tsx migration-runner.ts [command] [options]

Commands:
  run [--dry-run] [--force]                    Run all pending migrations

Examples:
  tsx migration-runner.ts run
  tsx migration-runner.ts run --dry-run
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
