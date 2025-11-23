import { and, eq, isNull } from 'drizzle-orm';
import { drizzleDb } from '../db/connection';
import {
  products,
  type NewProduct,
  type Product,
  type UpdateProduct,
} from '../schema/entities/products';

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

  async findAll(includeDeleted = false): Promise<Product[]> {
    const where = includeDeleted ? undefined : isNull(products.deletedAt);
    return this.db.select().from(products).where(where);
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
