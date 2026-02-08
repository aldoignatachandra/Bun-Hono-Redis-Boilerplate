import { Service } from 'typedi';
import { ProductRepository, type ProductRepositoryOptions } from '../ProductRepository';

@Service()
export class GetProductQuery {
  constructor(private productRepository: ProductRepository) {}

  async execute(id: string, options: ProductRepositoryOptions = {}) {
    return this.productRepository.findById(id, options);
  }

  async executeByOwner(ownerId: string, options: ProductRepositoryOptions = {}) {
    return this.productRepository.findByOwner(ownerId, options);
  }

  async executeUserProductsOptimized(userId: string, options: ProductRepositoryOptions = {}) {
    return this.productRepository.findUserProductsOptimized(userId, options);
  }

  // Methods to include deleted records
  async executeWithDeleted(id: string) {
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

  // Search methods
  async executeSearch(query: string, options: ProductRepositoryOptions = {}) {
    return this.productRepository.searchProducts(query, options);
  }

  async executeSearchWithDeleted(query: string, options: ProductRepositoryOptions = {}) {
    return this.productRepository.searchProductsWithDeleted(query, options);
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
