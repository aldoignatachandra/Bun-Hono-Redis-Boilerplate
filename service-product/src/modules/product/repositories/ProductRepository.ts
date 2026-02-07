import { Service } from 'typedi';
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
}

@Service()
export class ProductRepository {
  private drizzleProductRepo: DrizzleProductRepository;

  constructor() {
    this.drizzleProductRepo = new DrizzleProductRepository();
  }

  async create(data: { name: string; price: number; ownerId: string }): Promise<ProductResponse> {
    return this.drizzleProductRepo.create(data as NewProduct) as Promise<ProductResponse>;
  }

  async findById(
    id: string,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse | null> {
    // drizzleRepo.findById signature: (id: string, includeDeleted?: boolean)
    const product = await this.drizzleProductRepo.findById(id, options.includeDeleted);
    return product as unknown as ProductResponse | null;
  }

  async findByOwner(
    ownerId: string,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    // drizzleRepo.findByOwnerId signature: (ownerId: string) -> returns all active (not deleted)
    // Wait, findByOwnerId implementation in drizzle:
    // return this.db.select().from(products).where(and(eq(products.ownerId, ownerId), isNull(products.deletedAt)));
    // So it ONLY returns active.

    // If we want includeDeleted, we can't use findByOwnerId from drizzle repo as is.
    // But since this is a boilerplate fix and I can't easily change drizzle repo without rebuilding everything again,
    // I'll stick to what's available or use findAll and filter in memory (inefficient but works for now).

    // Actually, let's look at findAll in drizzle repo:
    // async findAll(includeDeleted = false)

    const allProducts = await this.drizzleProductRepo.findAll(
      options.includeDeleted || options.onlyDeleted
    );

    let filtered = allProducts.filter(p => p.ownerId === ownerId);

    if (options.onlyDeleted) {
      filtered = filtered.filter(p => p.deletedAt !== null);
    } else if (options.onlyActive) {
      // or default if not includeDeleted
      filtered = filtered.filter(p => p.deletedAt === null);
    } else if (!options.includeDeleted) {
      filtered = filtered.filter(p => p.deletedAt === null);
    }

    return filtered as unknown as ProductResponse[];
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

  // Restore a soft-deleted product
  async restore(id: string): Promise<boolean> {
    return this.drizzleProductRepo.restore(id);
  }

  // Find a product including deleted records (needed for restore operation)
  async findByIdWithDeleted(id: string): Promise<ProductResponse | null> {
    const product = await this.drizzleProductRepo.findById(id, true);
    return product as unknown as ProductResponse | null;
  }

  // Missing methods implemented via in-memory filtering (for boilerplate purposes)

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

  async findDeletedOnly(_options: ProductRepositoryOptions = {}): Promise<ProductResponse[]> {
    const all = await this.drizzleProductRepo.findAll(true);
    return all.filter(p => p.deletedAt !== null) as unknown as ProductResponse[];
  }

  async searchProducts(
    query: string,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    const all = await this.drizzleProductRepo.findAll(
      options.includeDeleted || options.onlyDeleted
    );
    const lowerQuery = query.toLowerCase();

    let filtered = all.filter(p => p.name.toLowerCase().includes(lowerQuery));

    if (options.onlyDeleted) {
      filtered = filtered.filter(p => p.deletedAt !== null);
    } else if (!options.includeDeleted) {
      filtered = filtered.filter(p => p.deletedAt === null);
    }

    return filtered as unknown as ProductResponse[];
  }

  async searchProductsWithDeleted(
    query: string,
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    return this.searchProducts(query, { ...options, includeDeleted: true });
  }

  async findByPriceRange(
    range: { min?: number; max?: number },
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    const all = await this.drizzleProductRepo.findAll(
      options.includeDeleted || options.onlyDeleted
    );

    let filtered = all;
    if (range.min !== undefined) {
      filtered = filtered.filter(p => p.price >= range.min!);
    }
    if (range.max !== undefined) {
      filtered = filtered.filter(p => p.price <= range.max!);
    }

    if (options.onlyDeleted) {
      filtered = filtered.filter(p => p.deletedAt !== null);
    } else if (!options.includeDeleted) {
      filtered = filtered.filter(p => p.deletedAt === null);
    }

    return filtered as unknown as ProductResponse[];
  }

  async findByPriceRangeWithDeleted(
    range: { min?: number; max?: number },
    options: ProductRepositoryOptions = {}
  ): Promise<ProductResponse[]> {
    return this.findByPriceRange(range, { ...options, includeDeleted: true });
  }
}
