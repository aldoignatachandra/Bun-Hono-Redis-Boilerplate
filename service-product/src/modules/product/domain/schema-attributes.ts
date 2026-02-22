import { index, integer, jsonb, uuid, varchar } from 'drizzle-orm/pg-core';
import { createParanoidTable } from '../../../helpers/schema/base-table';
import { products } from './schema';

// Product attributes table schema
// Stores attribute definitions (e.g., Color, Size) with their valid values as JSONB array
// Each product can have multiple attributes (e.g., Color, Size, Material)
export const productAttributes = createParanoidTable(
  'product_attributes',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    // JSONB array of valid values: ["Red", "Blue", "Green"]
    values: jsonb('values').notNull().$type<string[]>(),
    displayOrder: integer('display_order').default(0).notNull(),
  },
  table => ({
    productIdIdx: index('product_attributes_product_id_idx').on(table.productId),
    productIdNameIdx: index('product_attributes_product_id_name_idx').on(
      table.productId,
      table.name
    ),
  })
);

// TypeScript types
export type ProductAttribute = typeof productAttributes.$inferSelect;
export type NewProductAttribute = typeof productAttributes.$inferInsert;
export type UpdateProductAttribute = Partial<
  Omit<ProductAttribute, 'id' | 'createdAt' | 'updatedAt'>
>;
