import { boolean, decimal, index, integer, uuid, varchar } from 'drizzle-orm/pg-core';
import { BaseParanoidEntity, createParanoidTable } from '../../../helpers/schema/base-table';

// Product table schema
// Updated: Added stock and has_variant for variant support
// stock: Aggregated from variants via PostgreSQL trigger (or direct for simple products)
// has_variant: Boolean flag indicating if product has variants
export const products = createParanoidTable(
  'products',
  {
    name: varchar('name', { length: 255 }).notNull(),
    price: decimal('price', { precision: 10, scale: 2 }).notNull().$type<number>(),
    ownerId: uuid('owner_id').notNull(),
    // New fields for variant support
    stock: integer('stock').default(0).notNull(),
    hasVariant: boolean('has_variant').default(false).notNull(),
  },
  table => ({
    ownerIdIdx: index('products_owner_id_idx').on(table.ownerId),
    nameIdx: index('products_name_idx').on(table.name),
    priceIdx: index('products_price_idx').on(table.price),
    // New indexes for variant-related queries
    hasVariantIdx: index('products_has_variant_idx').on(table.hasVariant),
    stockIdx: index('products_stock_idx').on(table.stock),
  })
);

// TypeScript types for Product entity
export type Product = typeof products.$inferSelect; // Select type
export type NewProduct = typeof products.$inferInsert; // Insert type
export type UpdateProduct = Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>;

// Enhanced product types with paranoid support
export interface ProductEntity extends BaseParanoidEntity {
  name: string;
  price: number;
  ownerId: string;
  stock: number;
  hasVariant: boolean;
}

// Price range for products with variants
export interface PriceRange {
  min: number;
  max: number;
  display: string;
}

export interface CreateProductRequest {
  name: string;
  price: number;
  ownerId: string;
  stock?: number;
}

export interface UpdateProductRequest {
  name?: string;
  price?: number;
  ownerId?: string;
  stock?: number;
}

// Product query types
export interface ProductQueryOptions {
  includeOwner?: boolean;
  includeVariants?: boolean;
  paranoid?: {
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
    onlyActive?: boolean;
  };
  ownerId?: string;
  search?: string;
  hasVariant?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'price' | 'stock' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

// Product response types
export interface ProductResponse {
  id: string;
  name: string;
  price: number | PriceRange;
  stock: number;
  hasVariant: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ProductWithOwnerResponse extends ProductResponse {
  owner: UserResponse;
}

// Forward declaration for UserResponse
interface UserResponse {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
