# Drizzle ORM Best Practices

This boilerplate demonstrates production-ready Drizzle ORM patterns that are simple, type-safe, and easy to understand.

## Table of Contents

1. [Connection Management](#connection-management)
2. [Schema Design](#schema-design)
3. [Soft Delete Pattern](#soft-delete-pattern)
4. [Repository Pattern](#repository-pattern)
5. [Type Safety](#type-safety)
6. [Migrations](#migrations)

---

## Connection Management

### Simple Environment-Based Configuration

The connection is configured using environment variables with sensible defaults:

```typescript
// packages/drizzle/src/db/connection.ts
const connectionConfig = {
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT || '20'),
  connect_timeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10'),
};

function getDatabaseUrl(): string {
  const dbUrl = process.env.DB_URL;

  if (!dbUrl) {
    const defaultUrl = 'postgresql://postgres:postgres@localhost:5432/cqrs_demo';
    console.warn(`DB_URL not found in environment, using default: ${defaultUrl}`);
    return defaultUrl;
  }

  return dbUrl;
}
```

**Key Points:**

- ✅ Environment variables as the single source of truth
- ✅ Sensible defaults for development
- ✅ Clear error messages
- ✅ No complex configuration merging

### Connection Pooling

```typescript
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
```

**Best Practices:**

- Use connection pooling for better performance
- Enable query logging only in development
- Export a single database instance for reuse

---

## Schema Design

### Base Table with Soft Delete Support

This boilerplate uses a helper function to create tables with built-in soft delete (paranoid) support:

```typescript
// packages/drizzle/src/schema/core/base-table.ts
export function createParanoidTable<TName extends string>(
  name: TName,
  columns: Record<string, AnyPgColumn>,
  extraConfig?: { indexes?: Record<string, ReturnType<typeof index>> }
) {
  return pgTable(
    name,
    {
      // Base paranoid fields
      id: uuid('id').defaultRandom().primaryKey(),
      createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp('updated_at', { mode: 'date', withTimezone: true })
        .defaultNow()
        .notNull(),
      deletedAt: timestamp('deleted_at', { mode: 'date', withTimezone: true }),

      // Custom columns
      ...columns,
    },
    table => ({
      // Paranoid index for efficient soft delete queries
      paranoidIndex: index(`${name}_deleted_at_idx`).on(table.deletedAt),
      ...extraConfig?.indexes,
    })
  );
}
```

**Why This Pattern?**

- 🎯 Consistent base fields across all tables (id, timestamps, deletedAt)
- 🎯 Automatic indexing on `deletedAt` for performance
- 🎯 DRY principle - don't repeat yourself
- 🎯 Type-safe with TypeScript

### Entity Example

```typescript
// packages/drizzle/src/schema/entities/users.ts
export const users = createParanoidTable('users', {
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  role: roleEnum,
});

// TypeScript types inferred from schema
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;
```

**Key Benefits:**

- ✨ Clean and concise schema definition
- ✨ Automatic type inference from schema
- ✨ No manual type definitions needed

---

## Soft Delete Pattern

### Why Soft Delete?

Soft delete (paranoid) allows you to "delete" records without actually removing them from the database. This is useful for:

- 📊 Audit trails
- 🔄 Data recovery
- 📈 Historical analysis
- 🔐 Compliance requirements

### Implementation

```typescript
// Soft delete a user
async softDelete(id: string): Promise<boolean> {
  await this.db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.id, id));
  return true;
}

// Restore a deleted user
async restore(id: string): Promise<boolean> {
  await this.db
    .update(users)
    .set({ deletedAt: null })
    .where(eq(users.id, id));
  return true;
}

// Hard delete (permanent)
async hardDelete(id: string): Promise<boolean> {
  await this.db
    .delete(users)
    .where(eq(users.id, id));
  return true;
}
```

### Querying with Soft Delete

```typescript
// Find only non-deleted users
async findById(id: string): Promise<User | null> {
  const result = await this.db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return result[0] || null;
}

// Include deleted users (optional)
async findById(id: string, includeDeleted = false): Promise<User | null> {
  const where = includeDeleted
    ? eq(users.id, id)
    : and(eq(users.id, id), isNull(users.deletedAt));

  const result = await this.db
    .select()
    .from(users)
    .where(where)
    .limit(1);
  return result[0] || null;
}
```

**Performance Note:** The `deletedAt` column is automatically indexed for efficient queries.

---

## Repository Pattern

### Why Repository Pattern?

The repository pattern provides:

- 🏗️ Abstraction over database operations
- 🧪 Easier testing (can mock repositories)
- 🔄 Consistent API across entities
- 📦 Encapsulation of query logic

### Example Repository

```typescript
// packages/drizzle/src/repositories/user-repository.ts
export class UserRepository {
  private db = drizzleDb;

  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return result[0] || null;
  }

  async create(data: NewUser): Promise<User> {
    // Check for duplicates
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new Error(`User with email ${data.email} already exists`);
    }

    const result = await this.db.insert(users).values(data).returning();
    return result[0];
  }

  async update(id: string, data: UpdateUser): Promise<User | null> {
    const result = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();
    return result[0] || null;
  }

  // ... other methods
}

// Export a singleton instance
export const userRepository = new UserRepository();
```

**Usage in Services:**

```typescript
import { userRepository } from '@cqrs/drizzle';

// In your service
const user = await userRepository.findById(userId);
const newUser = await userRepository.create({ email, password, role });
```

---

## Type Safety

### Drizzle's Type Inference

Drizzle provides excellent type inference:

```typescript
// Schema definition
export const users = createParanoidTable('users', {
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  role: roleEnum,
});

// Automatic type inference
export type User = typeof users.$inferSelect;
// Result: { id: string; email: string; password: string; role: 'ADMIN' | 'USER';
//           createdAt: Date; updatedAt: Date; deletedAt: Date | null }

export type NewUser = typeof users.$inferInsert;
// Result: { email: string; password: string; role?: 'ADMIN' | 'USER';
//           id?: string; createdAt?: Date; ... }
```

### Custom Type Helpers

```typescript
// For updates (exclude immutable fields)
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

// Generic helpers
export type CreateEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type UpdateEntity<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;
```

**Benefits:**

- 💪 Full TypeScript autocomplete
- 🛡️ Compile-time type safety
- 🔄 Schema changes automatically reflect in types
- 📝 Self-documenting code

---

## Migrations

### Running Migrations

```bash
# Generate migration from schema changes
bun run db:generate

# Run pending migrations
bun run db:migrate
```

### Migration Best Practices

1. **Always review generated migrations** before running them
2. **Test migrations on a copy of production data** before deploying
3. **Keep migrations reversible** when possible
4. **Version control all migrations**
5. **Don't modify past migrations** after they've been run in production

### Example Migration Workflow

```bash
# 1. Modify your schema
# packages/drizzle/src/schema/entities/users.ts
export const users = createParanoidTable('users', {
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password').notNull(),
  role: roleEnum,
  // New field added
  phoneNumber: varchar('phone_number', { length: 20 }),
});

# 2. Generate migration
bun run db:generate
# This creates a new migration file in migrations/

# 3. Review the generated SQL

# 4. Run migration
bun run db:migrate
```

---

## Summary

This boilerplate follows these key principles:

1. **Simplicity First** - No over-engineering
2. **Type Safety** - Leverage TypeScript and Drizzle's type inference
3. **Environment-Based Config** - Single source of truth
4. **Soft Delete by Default** - Safer than hard deletes
5. **Repository Pattern** - Clean separation of concerns
6. **Educational** - Easy to learn and understand

### Quick Reference

| Task                | Command               |
| ------------------- | --------------------- |
| Generate migrations | `bun run db:generate` |
| Run migrations      | `bun run db:migrate`  |
| Open Drizzle Studio | `bun run db:studio`   |
| Build package       | `bun run build`       |
| Lint package        | `bun run lint`        |

### Further Reading

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
