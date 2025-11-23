# @cqrs/drizzle

Drizzle ORM schema and migrations for CQRS microservices.

## Overview

This package provides a complete Drizzle ORM implementation with:

- **Type-safe schema definitions** for all entities
- **Paranoid/soft delete patterns** with automatic filtering
- **Custom migration system** with rollback capabilities
- **Repository pattern** with full TypeScript support
- **Transaction management** with nested transaction support

## Installation

```bash
bun add @cqrs/drizzle
```

## Usage

### Database Connection

```typescript
import { drizzleDb, checkDatabaseHealth } from '@cqrs/drizzle';

// Check database health
const isHealthy = await checkDatabaseHealth();

// Use the database client
const users = await drizzleDb.query.users.select().execute();
```

### Paranoid Queries

```typescript
import { ParanoidQueryBuilder } from '@cqrs/drizzle';

// Find only active records (default behavior)
const activeUsers = await db.users.findMany({
  paranoid: { onlyActive: true },
});

// Find all records including deleted
const allUsers = await db.users.findMany({
  paranoid: { includeDeleted: true },
});

// Find only deleted records
const deletedUsers = await db.users.findMany({
  paranoid: { onlyDeleted: true },
});
```

### Soft Delete Operations

```typescript
// Soft delete a user
await db.users.softDelete('user-id', { deletedBy: 'admin' });

// Restore a soft-deleted user
await db.users.restore('user-id', { restoredBy: 'admin' });

// Force hard delete
await db.users.delete('user-id', { force: true });
```

### Transactions

```typescript
import { drizzleDb } from '@cqrs/drizzle';

// Simple transaction
await drizzleDb.transaction(async tx => {
  await tx.users.create({ email: 'test@example.com', password: 'hashed', role: 'USER' });
  await tx.products.create({ name: 'Test Product', price: 100, ownerId: 'user-id' });
});

// Parallel operations in transaction
await drizzleDb.transaction.parallel(async tx => {
  const userPromise = tx.users.create(userData);
  const productPromise = tx.products.create(productData);

  const [user, product] = await Promise.all([userPromise, productPromise]);

  return { user, product };
});
```

## Schema

### Users

```typescript
interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
```

### Products

```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
```

### Event Deduplication

```typescript
interface EventDedup {
  key: string;
  firstSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
```

## Migration System

This package includes a comprehensive migration system with advanced features:

### Features

- **Migration Creation**: Generate new migrations with up and down SQL
- **Migration Execution**: Apply migrations with dependency checking and validation
- **Rollback Support**: Rollback specific migrations, batches, or by steps
- **Status Tracking**: Comprehensive migration status and history tracking
- **Health Monitoring**: System health checks and validation
- **Environment Support**: Environment-specific migration management
- **Batch Operations**: Group migrations into batches for better tracking
- **Safety Features**: Dependency validation, rollback previews, and dry-run modes

### Quick Start

```bash
# Test the migration system
bun run migrate:test

# Create a new migration
bun run migrate:create --name=add_user_profile

# Apply all pending migrations
bun run migrate

# Apply specific number of migrations
bun run migrate -- --steps=3

# Show migration status
bun run migrate:status

# Rollback last migration
bun run migrate:down

# Rollback with preview
bun run migrate:preview --steps=2

# Show migration summary
bun run migrate:summary

# Perform health check
bun run migrate:health
```

### Advanced Migration Commands

```bash
# Run migrations with validation
bun run migrate:run

# Validate all migrations
bun run migrate:validate

# Rollback to specific migration
bun run migrate:rollback --to=2024-01-01-00-00_add_users_table

# Rollback specific batch
bun run migrate:rollback --batch=550e8400-e29b-41d4-a716-446655440000

# Show rollback history
bun run migrate:history

# Force rollback (override safety checks)
bun run migrate:rollback --force --steps=1

# Dry run operations
bun run migrate -- --dry-run
bun run migrate:rollback -- --dry-run --steps=1
```

### Migration File Structure

Each migration follows this structure:

```
2024-01-01-00-00_add_users_table/
├── migration.sql     # Up migration SQL
├── down.sql          # Down migration SQL (optional)
└── migration.toml    # Migration metadata
```

For detailed documentation, see [src/migrations/README.md](./src/migrations/README.md).

## Migration Commands

### Generate Migrations from Schema Changes

Generate migrations automatically when you modify your schema files:

```bash
# Generate new migration from schema changes
bun run generate
```

### Apply Migrations

```bash
# Apply all pending migrations (recommended for production)
bun run migrate

# Alternative: apply all pending migrations
bun run migrate:all

# Apply only one pending migration at a time
bun run migrate:one

# Rollback the last applied migration
bun run migrate:down:one
```

### Advanced Migration Operations

```bash
# Create a new custom migration manually
bun run migrate:create --name=add_new_field

# Check migration status
bun run migrate:status

# Show migration summary
bun run migrate:summary

# Perform health check
bun run migrate:health

# Rollback with preview
bun run migrate:preview --steps=2

# Rollback to specific migration
bun run migrate:rollback --to=2024-01-01-00-00_add_users_table

# Show rollback history
bun run migrate:history
```

### Database Development Tools

```bash
# Open Drizzle Studio (visual database browser)
bun run db:studio

# Push schema changes directly (development only)
bun run db:push

# Check migration files for issues
bun run db:check

# Seed database with sample data
bun run db:seed
```

## Development

```bash
# Install dependencies
bun install

# Build package
bun run build

# Run tests
bun test

# Start development mode
bun run dev
```

## Configuration

Environment variables:

- `DB_URL`: PostgreSQL connection string
- `NODE_ENV`: Environment (development/staging/production)
- `DB_LOGGING`: Enable database logging (true/false)
- `DB_MAX_CONNECTIONS`: Maximum database connections (default: 20)

## Features

### Paranoid Support

All tables support soft delete with automatic filtering:

- `deletedAt` field for soft delete timestamp
- Automatic filtering of deleted records by default
- Configurable paranoid behavior per query
- Efficient indexes for soft delete queries

### Type Safety

Full TypeScript support with:

- Inferred types from schema
- Type-safe query builders
- Compile-time type checking
- Runtime validation utilities

### Migration System

Enhanced migration features:

- Custom rollback system with risk assessment
- Migration dependency tracking
- Automated backup creation
- Dry-run capabilities for safe testing

### Performance Optimizations

- Optimized indexes for common queries
- Connection pooling configuration
- Query result caching
- Efficient batch operations
