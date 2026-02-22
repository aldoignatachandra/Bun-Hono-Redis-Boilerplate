import { Service } from 'typedi';
import type {
  CreateProductWithVariantsRequest,
  ProductWithVariantsResponse,
  UpdateProductWithVariantsRequest,
} from '../domain/types';
import {
  ProductRepository as DrizzleProductRepository,
  type NewProduct,
  type Product as ProductResponse,
  type UpdateProduct,
} from './drizzle-repo';

export interface ProductRepositoryOptions {
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
  onlyActive?: boolean;
  limit?: number;
  offset?: number;
  includeVariants?: boolean;
  hasVariant?: boolean;
  inStock?: boolean;
}

@Service()
export class ProductRepository {
  private drizzleProductRepo: DrizzleProductRepository;

  constructor() {
    this.drizzleProductRepo = new DrizzleProductRepository();
  }

  async create(data: {
    name: string;
    price: number;
    ownerId: string;
    stock?: number;
  }): Promise<ProductResponse> {
    return this.drizzleProductRepo.create(data as NewProduct) as Promise<ProductResponse>;
  }

  // ============================================
  // Variant-Aware Methods
  // ============================================

  async createWithVariants(
    data: CreateProductWithVariantsRequest
  ): Promise<ProductWithVariantsResponse> {
    return this.drizzleProductRepo.createWithVariants(data);
  }

  async updateWithVariants(
    id: string,
    data: UpdateProductWithVariantsRequest
  ): Promise<ProductWithVariantsResponse | null> {
    return this.drizzleProductRepo.updateWithVariants(id, data);
  }

  async findByIdWithVariants(id: string): Promise<ProductWithVariantsResponse | null> {
    return this.drizzleProductRepo.findByIdWithVariants(id);
  }

  async findWithFiltersAndVariants(options: {
    ownerId?: string;
    search?: string;
    hasVariant?: boolean;
    inStock?: boolean;
    minPrice?: number;
    maxPrice?: number;
    includeVariants?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<ProductWithVariantsResponse[]> {
    return this.drizzleProductRepo.findWithFiltersAndVariants(options);
  }

  // ============================================
  // Basic CRUD Operations
  // ============================================

  async findById(
    id: string,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse | null> {
    const product = await this.drizzleProductRepo.findById(id, options.includeDeleted);
    return product as unknown as ProductResponse | null;
  }

  async findWithFilters(options: {
    ownerId?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
    limit?: number;
    offset?: number;
    hasVariant?: boolean;
    inStock?: boolean;
  }): Promise<ProductResponse[]> {
    const products = await this.drizzleProductRepo.findWithFilters(options);
    return products as unknown as ProductResponse[];
  }

  async findByOwner(
    ownerId: string,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    return this.findWithFilters({
      ownerId,
      includeDeleted: options.includeDeleted,
      onlyDeleted: options.onlyDeleted,
      limit: options.limit,
      offset: options.offset,
    });
  }

  async update(
    id: string,
    data: Partial<ProductResponse>,
    _options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse | null> {
    const product = await this.drizzleProductRepo.update(id, data as UpdateProduct);
    return product as unknown as ProductResponse | null;
  }

  async delete(id: string, force: boolean = false): Promise<boolean> {
    if (force) {
      return this.drizzleProductRepo.hardDelete(id);
    }
    return this.drizzleProductRepo.softDelete(id);
  }

  async restore(id: string): Promise<boolean> {
    return this.drizzleProductRepo.restore(id);
  }

  async findByIdWithDeleted(id: string): Promise<ProductResponse | null> {
    const product = await this.drizzleProductRepo.findById(id, true);
    return product as unknown as ProductResponse | null;
  }

  // ============================================
  // Query Methods
  // ============================================

  async findUserProductsOptimized(
    userId: string,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    return this.findByOwner(userId, options);
  }

  async findDeletedByOwner(
    ownerId: string,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    return this.findByOwner(ownerId, { ...options, onlyDeleted: true });
  }

  async findByOwnerWithDeleted(
    ownerId: string,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    return this.findByOwner(ownerId, { ...options, includeDeleted: true });
  }

  async findDeletedOnly(options: ProductRepositoryOptions = {}): Promise<ProductResponse[]> {
    return this.findWithFilters({
      onlyDeleted: true,
      limit: options.limit,
      offset: options.offset,
    });
  }

  async findByPriceRange(
    range: { min?: number; max?: number },
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    return this.findWithFilters({
      minPrice: range.min,
      maxPrice: range.max,
      includeDeleted: options.includeDeleted,
      onlyDeleted: options.onlyDeleted,
      limit: options.limit,
      offset: options.offset,
    });
  }

  async findByPriceRangeWithDeleted(
    range: { min?: number; max?: number },
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    return this.findByPriceRange(range, { ...options, includeDeleted: true });
  }

  // ============================================
  // Variant-Specific Query Methods
  // ============================================

  async findByVariantStatus(
    hasVariant: boolean,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    return this.findWithFilters({
      hasVariant,
      includeDeleted: options.includeDeleted,
      onlyDeleted: options.onlyDeleted,
      limit: options.limit,
      offset: options.offset,
    });
  }

  async findInStock(options: ProductRepositoryOptions = {}): Promise<ProductResponse[]> {
    return this.findWithFilters({
      inStock: true,
      includeDeleted: options.includeDeleted,
      onlyDeleted: options.onlyDeleted,
      limit: options.limit,
      offset: options.offset,
    });
  }
}
