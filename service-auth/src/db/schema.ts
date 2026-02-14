import { index, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { BaseParanoidEntity, createParanoidTable } from '../helpers/schema/base-table';
import { roleEnum } from '../helpers/schema/enums';

// -----------------------------------------------------------------------------
// USER MODEL (Read-Only Replica from service-user)
// -----------------------------------------------------------------------------
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

// TypeScript types for User entity
export type User = typeof users.$inferSelect;
export interface UserEntity extends BaseParanoidEntity {
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
}

// -----------------------------------------------------------------------------
// USER SESSION MODEL (Active Sessions)
// -----------------------------------------------------------------------------
export const userSessions = createParanoidTable(
  'user_sessions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }), // Cascade delete if user is removed
    token: text('token'), // Optional: Hash of the JWT signature for auditing
    ipAddress: varchar('ip_address', { length: 45 }), // IPv6 support
    userAgent: text('user_agent'),
    deviceType: varchar('device_type', { length: 50 }), // 'mobile', 'tablet', 'desktop', 'unknown'
    expiresAt: timestamp('expires_at', { mode: 'date', withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { mode: 'date', withTimezone: true }).defaultNow(),
  },
  table => ({
    userIdIdx: index('user_sessions_user_id_idx').on(table.userId),
  })
);

// TypeScript types for UserSession entity
export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

export interface UserSessionEntity extends BaseParanoidEntity {
  userId: string;
  token?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  expiresAt: Date;
  lastUsedAt?: Date | null;
}
