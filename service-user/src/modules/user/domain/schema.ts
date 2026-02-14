import { index, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { BaseParanoidEntity, createParanoidTable } from '../../../helpers/schema/base-table';
import { roleEnum } from '../../../helpers/schema/enums';

// User table schema
export const users = createParanoidTable(
  'users',
  {
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: text('password').notNull(),
    role: roleEnum('role'),
  },
  table => ({
    roleIdx: index('users_role_idx').on(table.role),
  })
);

// User Session Schema (Synced with service-auth)
export const userSessions = createParanoidTable(
  'user_sessions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token'),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    deviceType: varchar('device_type', { length: 50 }),
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }).defaultNow(),
  },
  table => ({
    userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
  })
);

// TypeScript types for User entity
export type User = typeof users.$inferSelect; // Select type
export type NewUser = typeof users.$inferInsert; // Insert type
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

// Enhanced user types with paranoid support
export interface UserEntity extends BaseParanoidEntity {
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role?: 'ADMIN' | 'USER';
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  role?: 'ADMIN' | 'USER';
}

// User query types
export interface UserQueryOptions {
  includeProducts?: boolean;
  paranoid?: {
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
    onlyActive?: boolean;
  };
  limit?: number;
  offset?: number;
  orderBy?: 'email' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

// User response types
export interface UserResponse {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface UserWithProductsResponse extends UserResponse {
  products: ProductResponse[];
}

// Forward declaration for ProductResponse
interface ProductResponse {
  id: string;
  name: string;
  price: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
