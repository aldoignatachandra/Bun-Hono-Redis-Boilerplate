import { index, integer, uuid, varchar } from 'drizzle-orm/pg-core';
import { BaseParanoidEntity, createParanoidTable } from '../../../helpers/schema/base-table';

// Product table schema
export const products = createParanoidTable(
  'products',
  {
    name: varchar('name', { length: 255 }).notNull(),
    price: integer('price').notNull(),
    ownerId: uuid('owner_id').notNull(),
  },
  table => ({
    ownerIdIdx: index('products_owner_id_idx').on(table.ownerId),
    nameIdx: index('products_name_idx').on(table.name),
    priceIdx: index('products_price_idx').on(table.price),
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
}

export interface CreateProductRequest {
  name: string;
  price: number;
  ownerId: string;
}

export interface UpdateProductRequest {
  name?: string;
  price?: number;
  ownerId?: string;
}

// Product query types
export interface ProductQueryOptions {
  includeOwner?: boolean;
  paranoid?: {
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
    onlyActive?: boolean;
  };
  ownerId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'price' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

// Product response types
export interface ProductResponse {
  id: string;
  name: string;
  price: number;
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
