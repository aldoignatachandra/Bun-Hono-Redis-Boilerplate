import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { createParanoidTable } from '../../../helpers/schema/base-table';
import { products } from './schema';

// Product variants table schema
// Stores individual sellable SKUs with their attribute combinations
// Each variant links to attribute values via JSONB map: {"Color": "Red", "Size": "S"}
export const productVariants = createParanoidTable(
  'product_variants',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: varchar('sku', { length: 100 }).notNull(),
    // NULL means use product base price
    price: decimal('price', { precision: 10, scale: 2 }).$type<number>(),
    stockQuantity: integer('stock_quantity').default(0).notNull(),
    stockReserved: integer('stock_reserved').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    // JSONB map of attribute name to value: {"Color": "Red", "Size": "S"}
    attributeValues: jsonb('attribute_values').notNull().$type<Record<string, string>>(),
  },
  table => ({
    productIdIdx: index('product_variants_product_id_idx').on(table.productId),
    skuIdx: unique('product_variants_sku_unique').on(table.sku),
    isActiveIdx: index('product_variants_is_active_idx').on(table.isActive),
  })
);

// TypeScript types
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;
export type UpdateProductVariant = Partial<Omit<ProductVariant, 'id' | 'createdAt' | 'updatedAt'>>;
