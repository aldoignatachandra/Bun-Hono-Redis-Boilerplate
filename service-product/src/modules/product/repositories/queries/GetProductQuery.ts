import { Service } from 'typedi';
import { ProductRepository, type ProductRepositoryOptions } from '../ProductRepository';

@Service()
export class GetProductQuery {
  constructor(private productRepository: ProductRepository) {}

  async execute(id: string, options: ProductRepositoryOptions = {}) {
    if (options.includeVariants) {
      return this.productRepository.findByIdWithVariants(id);
    }
    return this.productRepository.findById(id, options);
  }

  async executeByOwner(ownerId: string, options: ProductRepositoryOptions = {}) {
    return this.productRepository.findByOwner(ownerId, options);
  }

  async executeUserProductsOptimized(userId: string, options: ProductRepositoryOptions = {}) {
    return this.productRepository.findUserProductsOptimized(userId, options);
  }

  // Methods to include deleted records
  async executeWithDeleted(id: string, options: ProductRepositoryOptions = {}) {
    if (options.includeVariants) {
      // Note: findByIdWithVariants might need update to support deleted,
      // or we accept that variants are only for active products currently.
      // Assuming existing implementation:
      return this.productRepository.findByIdWithVariants(id);
    }
    return this.productRepository.findByIdWithDeleted(id);
  }

  async executeByOwnerWithDeleted(ownerId: string, options: ProductRepositoryOptions = {}) {
    return this.productRepository.findByOwnerWithDeleted(ownerId, options);
  }

  async executeDeletedByOwner(ownerId: string, options: ProductRepositoryOptions = {}) {
    return this.productRepository.findDeletedByOwner(ownerId, options);
  }

  async executeDeletedOnly(options: ProductRepositoryOptions = {}) {
    return this.productRepository.findDeletedOnly(options);
  }

  // Price range methods
  async executeByPriceRange(
    priceRange: { min?: number; max?: number },
    options: ProductRepositoryOptions = {}
  ) {
    return this.productRepository.findByPriceRange(priceRange, options);
  }

  async executeByPriceRangeWithDeleted(
    priceRange: { min?: number; max?: number },
    options: ProductRepositoryOptions = {}
  ) {
    return this.productRepository.findByPriceRangeWithDeleted(priceRange, options);
  }

  async executeWithFilters(options: {
    ownerId?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return this.productRepository.findWithFilters(options);
  }
}
