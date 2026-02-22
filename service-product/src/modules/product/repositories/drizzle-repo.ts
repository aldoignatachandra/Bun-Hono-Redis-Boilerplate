import { and, eq, gte, isNotNull, isNull, like, lte } from 'drizzle-orm';
import { drizzleDb } from '../../../db/connection';
import {
  products,
  type NewProduct,
  type PriceRange,
  type Product,
  type ProductQueryOptions,
  type UpdateProduct,
} from '../domain/schema';
import { productAttributes } from '../domain/schema-attributes';
import { productVariants } from '../domain/schema-variants';
import type {
  AttributeResponse,
  CreateProductWithVariantsRequest,
  ProductWithVariantsResponse,
  UpdateProductWithVariantsRequest,
  VariantResponse,
} from '../domain/types';

export { type NewProduct, type Product, type UpdateProduct };

// ============================================
// Type Helper Interfaces
// ============================================

interface ProductWithRelations {
  product: Product;
  attributes: AttributeResponse[];
  variants: VariantResponse[];
}

// ============================================
// Product Repository Class
// ============================================

export class ProductRepository {
  private db = drizzleDb;

  // ============================================
  // Basic CRUD Operations
  // ============================================

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
    hasVariant?: boolean;
    inStock?: boolean;
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
      hasVariant,
      inStock,
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

    if (hasVariant !== undefined) {
      conditions.push(eq(products.hasVariant, hasVariant));
    }

    if (inStock) {
      conditions.push(gte(products.stock, 1));
    }

    const productList = await this.db
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    // Format all products to ensure price is an object
    return productList.map(p => this.formatProductResponse(p, [], [])) as unknown as Product[];
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

  // ============================================
  // Variant-Aware Operations
  // ============================================

  async findByIdWithVariants(id: string): Promise<ProductWithVariantsResponse | null> {
    const product = await this.findById(id);
    if (!product) return null;

    // Fetch attributes
    const attributes = await this.db
      .select()
      .from(productAttributes)
      .where(and(eq(productAttributes.productId, id), isNull(productAttributes.deletedAt)));

    const attributesResponse: AttributeResponse[] = attributes.map(a => ({
      id: a.id,
      name: a.name,
      values: a.values as string[],
      displayOrder: a.displayOrder,
    }));

    // Fetch variants
    const variants = await this.db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, id), isNull(productVariants.deletedAt)));

    const variantsResponse: VariantResponse[] = variants.map(v => ({
      id: v.id,
      sku: v.sku,
      price: v.price,
      stockQuantity: v.stockQuantity,
      availableStock: v.stockQuantity - v.stockReserved,
      isActive: v.isActive,
      attributeValues: v.attributeValues as Record<string, string>,
    }));

    return this.formatProductResponse(product, attributesResponse, variantsResponse);
  }

  async findWithFiltersAndVariants(
    options: ProductQueryOptions
  ): Promise<ProductWithVariantsResponse[]> {
    const conditions = [isNull(products.deletedAt)];

    if (options.ownerId) conditions.push(eq(products.ownerId, options.ownerId));
    if (options.search) conditions.push(like(products.name, `%${options.search}%`));
    if (options.hasVariant !== undefined)
      conditions.push(eq(products.hasVariant, options.hasVariant));
    if (options.inStock) conditions.push(gte(products.stock, 1));
    if (options.minPrice !== undefined) conditions.push(gte(products.price, options.minPrice));
    if (options.maxPrice !== undefined) conditions.push(lte(products.price, options.maxPrice));

    const productList = await this.db
      .select()
      .from(products)
      .where(and(...conditions))
      .limit(options.limit ?? 10)
      .offset(options.offset ?? 0);

    if (options.includeVariants) {
      const results: ProductWithVariantsResponse[] = [];
      for (const p of productList) {
        const full = await this.findByIdWithVariants(p.id);
        if (full) results.push(full);
      }
      return results;
    }

    return productList.map(p => this.formatProductResponse(p, [], []));
  }

  // ============================================
  // Create Product with Variants (Transaction)
  // ============================================

  async createWithVariants(
    data: CreateProductWithVariantsRequest
  ): Promise<ProductWithVariantsResponse> {
    return await this.db.transaction(async tx => {
      // 1. Validate price
      if (data.price <= 0) {
        throw new Error('Product price must be greater than 0');
      }

      // 2. Create product
      const [product] = await tx
        .insert(products)
        .values({
          name: data.name,
          price: data.price,
          ownerId: data.ownerId,
          stock: data.stock ?? 0,
          hasVariant: !!(data.variants && data.variants.length > 0),
        })
        .returning();

      // 3. Create attributes if provided
      let attributesResponse: AttributeResponse[] = [];
      if (data.attributes && data.attributes.length > 0) {
        const attrs = await tx
          .insert(productAttributes)
          .values(
            data.attributes.map((attr, index) => ({
              productId: product.id,
              name: attr.name,
              values: attr.values,
              displayOrder: attr.displayOrder ?? index,
            }))
          )
          .returning();

        attributesResponse = attrs.map(a => ({
          id: a.id,
          name: a.name,
          values: a.values as string[],
          displayOrder: a.displayOrder,
        }));
      }

      // 4. Create variants if provided
      let variantsResponse: VariantResponse[] = [];
      if (data.variants && data.variants.length > 0) {
        // Validate variant prices
        for (const v of data.variants) {
          if (v.price !== undefined && v.price !== null && v.price <= 0) {
            throw new Error('Variant price must be greater than 0');
          }
        }

        const variants = await tx
          .insert(productVariants)
          .values(
            data.variants.map(v => ({
              productId: product.id,
              sku: v.sku,
              price: v.price ?? null,
              stockQuantity: v.stock ?? 0,
              isActive: v.isActive ?? true,
              attributeValues: v.attributeValues,
            }))
          )
          .returning();

        variantsResponse = variants.map(v => ({
          id: v.id,
          sku: v.sku,
          price: v.price,
          stockQuantity: v.stockQuantity,
          availableStock: v.stockQuantity - v.stockReserved,
          isActive: v.isActive,
          attributeValues: v.attributeValues as Record<string, string>,
        }));
      }

      // 5. Get updated product (trigger may have updated stock)
      const [updatedProduct] = await tx.select().from(products).where(eq(products.id, product.id));

      return this.formatProductResponse(updatedProduct, attributesResponse, variantsResponse);
    });
  }

  // ============================================
  // Update Product with Variants (Full Replacement)
  // ============================================

  async updateWithVariants(
    id: string,
    data: UpdateProductWithVariantsRequest
  ): Promise<ProductWithVariantsResponse | null> {
    return await this.db.transaction(async tx => {
      // 1. Check product exists
      const [existing] = await tx
        .select()
        .from(products)
        .where(and(eq(products.id, id), isNull(products.deletedAt)));

      if (!existing) return null;

      // 2. Prevent direct stock update if has variants
      if (existing.hasVariant && data.stock !== undefined) {
        throw new Error('Cannot update stock directly for products with variants');
      }

      // 3. Validate price
      if (data.price !== undefined && data.price <= 0) {
        throw new Error('Product price must be greater than 0');
      }

      // 4. Update product
      await tx
        .update(products)
        .set({
          name: data.name ?? existing.name,
          price: data.price ?? existing.price,
          ownerId: data.ownerId ?? existing.ownerId,
          stock: data.stock ?? existing.stock,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id));

      // 5. Replace attributes if provided
      let attributesResponse: AttributeResponse[] = [];
      if (data.attributes !== undefined) {
        // Soft delete existing
        await tx
          .update(productAttributes)
          .set({ deletedAt: new Date() })
          .where(eq(productAttributes.productId, id));

        // Insert new
        if (data.attributes.length > 0) {
          const attrs = await tx
            .insert(productAttributes)
            .values(
              data.attributes.map((attr, index) => ({
                productId: id,
                name: attr.name,
                values: attr.values,
                displayOrder: attr.displayOrder ?? index,
              }))
            )
            .returning();

          attributesResponse = attrs.map(a => ({
            id: a.id,
            name: a.name,
            values: a.values as string[],
            displayOrder: a.displayOrder,
          }));
        }
      } else {
        // Fetch existing
        const attrs = await tx
          .select()
          .from(productAttributes)
          .where(and(eq(productAttributes.productId, id), isNull(productAttributes.deletedAt)));

        attributesResponse = attrs.map(a => ({
          id: a.id,
          name: a.name,
          values: a.values as string[],
          displayOrder: a.displayOrder,
        }));
      }

      // 6. Replace variants if provided
      let variantsResponse: VariantResponse[] = [];
      if (data.variants !== undefined) {
        // Soft delete existing
        await tx
          .update(productVariants)
          .set({ deletedAt: new Date() })
          .where(eq(productVariants.productId, id));

        // Insert new
        if (data.variants.length > 0) {
          // Validate variant prices
          for (const v of data.variants) {
            if (v.price !== undefined && v.price !== null && v.price <= 0) {
              throw new Error('Variant price must be greater than 0');
            }
          }

          const variants = await tx
            .insert(productVariants)
            .values(
              data.variants.map(v => ({
                productId: id,
                sku: v.sku,
                price: v.price ?? null,
                stockQuantity: v.stock ?? 0,
                isActive: v.isActive ?? true,
                attributeValues: v.attributeValues,
              }))
            )
            .returning();

          variantsResponse = variants.map(v => ({
            id: v.id,
            sku: v.sku,
            price: v.price,
            stockQuantity: v.stockQuantity,
            availableStock: v.stockQuantity - v.stockReserved,
            isActive: v.isActive,
            attributeValues: v.attributeValues as Record<string, string>,
          }));
        }
      } else {
        // Fetch existing
        const variants = await tx
          .select()
          .from(productVariants)
          .where(and(eq(productVariants.productId, id), isNull(productVariants.deletedAt)));

        variantsResponse = variants.map(v => ({
          id: v.id,
          sku: v.sku,
          price: v.price,
          stockQuantity: v.stockQuantity,
          availableStock: v.stockQuantity - v.stockReserved,
          isActive: v.isActive,
          attributeValues: v.attributeValues as Record<string, string>,
        }));
      }

      // 7. Get final product state
      const [finalProduct] = await tx.select().from(products).where(eq(products.id, id));

      return this.formatProductResponse(finalProduct, attributesResponse, variantsResponse);
    });
  }

  // ============================================
  //Helper: Format Product Response
  // ============================================
  private formatProductResponse(
    product: Product,
    attributes: AttributeResponse[],
    variants: VariantResponse[]
  ): ProductWithVariantsResponse {
    // Helper to ensure number
    const toNum = (val: string | number | null | undefined): number => {
      if (val === null || val === undefined) return 0;
      const num = typeof val === 'string' ? parseFloat(val) : val;
      return isNaN(num) ? 0 : num;
    };

    // ALWAYS calculate price as an object, even if no variants
    let priceResponse: PriceRange;
    const productPrice = toNum(product.price);

    if (variants.length > 0) {
      const prices = variants.map(v => toNum(v.price)).filter(p => p > 0);
      if (prices.length > 0) {
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        priceResponse = {
          min,
          max,
          display: min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} - $${max.toFixed(2)}`,
        };
      } else {
        // Fallback if variants exist but have no valid prices (shouldn't happen with validation)
        priceResponse = {
          min: productPrice,
          max: productPrice,
          display: `$${productPrice.toFixed(2)}`,
        };
      }
    } else {
      // No variants: use product base price
      priceResponse = {
        min: productPrice,
        max: productPrice,
        display: `$${productPrice.toFixed(2)}`,
      };
    }

    return {
      id: product.id,
      name: product.name,
      price: priceResponse,
      ownerId: product.ownerId,
      stock: product.stock,
      hasVariant: product.hasVariant,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
      attributes,
      variants,
    };
  }
}

export const productRepository = new ProductRepository();
