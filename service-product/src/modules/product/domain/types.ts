// Product Variant Types
// All request/response types for the unified product API

import type { PriceRange } from './schema';

// ============ ATTRIBUTE TYPES ============

export interface CreateAttributeRequest {
  name: string;
  values: string[];
  displayOrder?: number;
}

export interface AttributeResponse {
  id: string;
  name: string;
  values: string[];
  displayOrder: number;
}

// ============ VARIANT TYPES ============

export interface CreateVariantRequest {
  sku: string;
  price?: number | null;
  stock?: number;
  isActive?: boolean;
  attributeValues: Record<string, string>;
}

export interface VariantResponse {
  id: string;
  sku: string;
  price: number | null;
  stockQuantity: number;
  availableStock: number;
  isActive: boolean;
  attributeValues: Record<string, string>;
}

// ============ PRODUCT REQUEST TYPES ============

export interface CreateProductWithVariantsRequest {
  name: string;
  price: number;
  ownerId: string;
  stock?: number;
  attributes?: CreateAttributeRequest[];
  variants?: CreateVariantRequest[];
}

export interface UpdateProductWithVariantsRequest {
  name?: string;
  price?: number;
  ownerId?: string;
  stock?: number;
  attributes?: CreateAttributeRequest[];
  variants?: CreateVariantRequest[];
}

// ============ PRODUCT RESPONSE TYPES ============

export interface ProductWithVariantsResponse {
  id: string;
  name: string;
  price: PriceRange;
  stock: number;
  hasVariant: boolean;
  ownerId: string;
  attributes?: AttributeResponse[];
  variants?: VariantResponse[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

// ============ QUERY OPTIONS ============

export interface ProductVariantQueryOptions {
  ownerId?: string;
  search?: string;
  hasVariant?: boolean;
  inStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  includeVariants?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'name' | 'price' | 'stock' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}
