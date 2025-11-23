import { index, pgTable, PgTableWithColumns, timestamp, uuid } from 'drizzle-orm/pg-core';

// Enhanced base table with paranoid/soft delete support
// Note: Using `any` here for simplicity and compatibility with Drizzle's column builder API
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */
export function createParanoidTable<TName extends string>(
  name: TName,
  columns: any,
  extraConfig?: any
): any {
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
      // Additional indexes from extraConfig
      ...extraConfig?.indexes,
    })
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access */

// Type helper for paranoid tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ParanoidTable<T extends PgTableWithColumns<any>> = T & {
  deletedAt: Date | null;
};

// Base entity type with paranoid fields
export interface BaseParanoidEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// Type for creating new entities (without generated fields)
export type CreateEntity<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

// Type for updating entities (without id and timestamps)
export type UpdateEntity<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

// Type for paranoid query options
export interface ParanoidOptions {
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  onlyActive?: boolean;
}
