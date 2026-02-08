import { and, eq, gte, isNotNull, isNull, like, lte } from 'drizzle-orm';
import { drizzleDb } from '../../../db/connection';
import { products, type NewProduct, type Product, type UpdateProduct } from '../domain/schema';

export { type NewProduct, type Product, type UpdateProduct };

export class ProductRepository {
  private db = drizzleDb;

  async findById(id: string, includeDeleted = false): Promise<Product | null> {
    const where = includeDeleted
      ? eq(products.id, id)
      : and(eq(products.id, id), isNull(products.deletedAt));

    const result = await this.db.select().from(products).where(where).limit(1);
    return result[0] || null;
  }

  async findByOwnerId(ownerId: string): Promise<Product[]> {
    return this.db
      .select()
      .from(products)
      .where(and(eq(products.ownerId, ownerId), isNull(products.deletedAt)));
  }

  async findAll(
    options: {
      includeDeleted?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Product[]> {
    const { includeDeleted = false, limit = 10, offset = 0 } = options;
    const where = includeDeleted ? undefined : isNull(products.deletedAt);
    return this.db.select().from(products).where(where).limit(limit).offset(offset);
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
  }): Promise<Product[]> {
    const {
      ownerId,
      search,
      minPrice,
      maxPrice,
      includeDeleted = false,
      onlyDeleted = false,
      limit = 10,
      offset = 0,
    } = options;

    const conditions = [];

    if (ownerId) {
      conditions.push(eq(products.ownerId, ownerId));
    }

    if (onlyDeleted) {
      conditions.push(isNotNull(products.deletedAt));
    } else if (!includeDeleted) {
      conditions.push(isNull(products.deletedAt));
    }

    if (search) {
      conditions.push(like(products.name, `%${search}%`));
    }

    if (minPrice !== undefined) {
      conditions.push(gte(products.price, minPrice));
    }

    if (maxPrice !== undefined) {
      conditions.push(lte(products.price, maxPrice));
    }

    return this.db
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);
  }

  async create(data: NewProduct): Promise<Product> {
    if (data.price <= 0) {
      throw new Error('Product price must be greater than 0');
    }

    const result = await this.db.insert(products).values(data).returning();
    return result[0];
  }

  async update(id: string, data: UpdateProduct): Promise<Product | null> {
    if (data.price !== undefined && data.price <= 0) {
      throw new Error('Product price must be greater than 0');
    }

    const result = await this.db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning();
    return result[0] || null;
  }

  async softDelete(id: string): Promise<boolean> {
    await this.db.update(products).set({ deletedAt: new Date() }).where(eq(products.id, id));
    return true;
  }

  async hardDelete(id: string): Promise<boolean> {
    await this.db.delete(products).where(eq(products.id, id));
    return true;
  }

  async restore(id: string): Promise<boolean> {
    await this.db.update(products).set({ deletedAt: null }).where(eq(products.id, id));
    return true;
  }
}

export const productRepository = new ProductRepository();
