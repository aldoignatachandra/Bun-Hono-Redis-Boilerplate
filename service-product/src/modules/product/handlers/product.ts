import { Hono } from 'hono';
import { Container } from 'typedi';
import { ZodError } from 'zod';
import { errorResponse, successResponse } from '../../../helpers/api-response';
import { getRequestMetadata } from '../../../helpers/request-metadata';
import { auth } from '../../../middlewares/auth';
import { rateLimiter } from '../../../middlewares/rate-limit';
import { CreateProductCommand } from '../repositories/commands/CreateProductCommand';
import { DeleteProductCommand } from '../repositories/commands/DeleteProductCommand';
import { RestoreProductCommand } from '../repositories/commands/RestoreProductCommand';
import { UpdateProductCommand } from '../repositories/commands/UpdateProductCommand';
import { GetProductQuery } from '../repositories/queries/GetProductQuery';
import { createProductSchema, updateProductSchema } from '../validators/product-validators';

// Define types for Hono context
type User = {
  sub: string;
  email: string;
  role: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

const productRoutes = new Hono();

// Product routes rate limits
const rateLimits = {
  create: { maxRequests: 20, windowSeconds: 60 },
  list: { maxRequests: 120, windowSeconds: 60 },
  update: { maxRequests: 30, windowSeconds: 60 },
  remove: { maxRequests: 10, windowSeconds: 60 },
};

// Authentication middleware for all product routes
productRoutes.use('/products/*', auth);

// Create product
productRoutes.post(
  '/products',
  rateLimiter(rateLimits.create.maxRequests, rateLimits.create.windowSeconds),
  async c => {
    try {
      const user = c.get('user');
      const body = await c.req.json();
      const validatedData = createProductSchema.parse(body);
      const metadata = getRequestMetadata(c);

      const createProductCommand = Container.get(CreateProductCommand);
      // Force cast to correct type since zod validation ensures structure but types might be loose
      const createData: any = validatedData;
      const product = await createProductCommand.execute(
        {
          ...createData,
          ownerId: user.sub,
        },
        metadata
      );

      return successResponse(c, product, 'Product created successfully', 201);
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(c, 'Validation failed', 'VALIDATION_ERROR', 400, error.errors);
      }
      return errorResponse(c, 'Failed to create product', 'PRODUCT_CREATE_FAILED', 400, error);
    }
  }
);

// Get user's products with paranoid support
productRoutes.get(
  '/products',
  rateLimiter(rateLimits.list.maxRequests, rateLimits.list.windowSeconds),
  async c => {
    try {
      const user = c.get('user');
      const includeDeleted = c.req.query('includeDeleted') === 'true';
      const onlyDeleted = c.req.query('onlyDeleted') === 'true';
      const search = c.req.query('search');
      const minPrice = c.req.query('minPrice') ? parseFloat(c.req.query('minPrice')!) : undefined;
      const maxPrice = c.req.query('maxPrice') ? parseFloat(c.req.query('maxPrice')!) : undefined;
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '10');
      const offset = (page - 1) * limit;

      const getProductQuery = Container.get(GetProductQuery);

      const filterOptions: any = {
        search,
        minPrice,
        maxPrice,
        includeDeleted,
        onlyDeleted,
        limit,
        offset,
      };

      // Strict IDOR Check:
      // If user is NOT admin, force ownerId filter to current user.
      // If user IS admin, do NOT force ownerId (allow seeing all products).
      if (user.role !== 'ADMIN') {
        filterOptions.ownerId = user.sub;
      }

      const { data, total } = await getProductQuery.executeWithFilters(filterOptions);

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return successResponse(c, data, 'Products fetched successfully', 200, {
        includeDeleted,
        onlyDeleted,
        search,
        priceRange: { min: minPrice, max: maxPrice },
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      });
    } catch (error) {
      return errorResponse(c, 'Failed to fetch products', 'PRODUCT_FETCH_FAILED', 500, error);
    }
  }
);

// Get product by ID with paranoid support
productRoutes.get('/products/:id', async c => {
  try {
    const user = c.get('user');
    const productId = c.req.param('id');
    const includeDeleted = c.req.query('includeDeleted') === 'true';

    const getProductQuery = Container.get(GetProductQuery);

    // If product has variants, we should fetch them
    const product = includeDeleted
      ? await getProductQuery.executeWithDeleted(productId, { includeVariants: true })
      : await getProductQuery.execute(productId, { includeVariants: true });

    if (!product) {
      return errorResponse(c, 'Product not found', 'PRODUCT_NOT_FOUND', 404);
    }

    // Strict IDOR Check:
    // 1. Fetch product first (including deleted if requested)
    // 2. If User -> MUST be owner (ownerId === user.sub)
    // 3. If Admin -> Can access ANY product (no ownership check needed)

    // Check ownership for non-admin users
    if (user.role !== 'ADMIN' && product.ownerId !== user.sub) {
      return errorResponse(c, 'Access denied', 'ACCESS_DENIED', 403);
    }

    return successResponse(c, product, 'Product fetched successfully');
  } catch (error) {
    return errorResponse(c, 'Failed to fetch product', 'PRODUCT_FETCH_FAILED', 500, error);
  }
});

// Update product (owner only)
productRoutes.patch(
  '/products/:id',
  rateLimiter(rateLimits.update.maxRequests, rateLimits.update.windowSeconds),
  async c => {
    try {
      const user = c.get('user');
      const productId = c.req.param('id');
      const body = await c.req.json();
      const validatedData = updateProductSchema.parse(body);

      // Strict IDOR Check: Only OWNER can update. Admin CANNOT update user products.
      const getProductQuery = Container.get(GetProductQuery);
      const existingProduct = await getProductQuery.execute(productId);

      if (!existingProduct) {
        return errorResponse(c, 'Product not found', 'PRODUCT_NOT_FOUND', 404);
      }

      if (existingProduct.ownerId !== user.sub) {
        return errorResponse(
          c,
          'Access denied. Only owner can update product.',
          'ACCESS_DENIED',
          403
        );
      }

      const updateProductCommand = Container.get(UpdateProductCommand);
      // Force cast to correct type since zod validation ensures structure but types might be loose
      const updateData: any = validatedData;
      const product = await updateProductCommand.execute(productId, updateData, user.sub);

      return successResponse(c, product, 'Product updated successfully');
    } catch (error) {
      if (error instanceof ZodError) {
        return errorResponse(c, 'Validation failed', 'VALIDATION_ERROR', 400, error.errors);
      }
      return errorResponse(c, 'Failed to update product', 'PRODUCT_UPDATE_FAILED', 400, error);
    }
  }
);

// Delete product (owner only) with paranoid support
productRoutes.delete(
  '/products/:id',
  rateLimiter(rateLimits.remove.maxRequests, rateLimits.remove.windowSeconds),
  async c => {
    try {
      const user = c.get('user');
      const productId = c.req.param('id');
      const force = c.req.query('force') === 'true';

      // Strict IDOR Check: Only OWNER can delete. Admin CANNOT delete user products.
      const getProductQuery = Container.get(GetProductQuery);

      // Use executeWithDeleted to check if it exists at all before checking ownership
      const existingProduct = await getProductQuery.executeWithDeleted(productId);

      if (!existingProduct) {
        return errorResponse(c, 'Product not found', 'PRODUCT_NOT_FOUND', 404);
      }

      if (existingProduct.ownerId !== user.sub) {
        return errorResponse(
          c,
          'Access denied. Only owner can delete product.',
          'ACCESS_DENIED',
          403
        );
      }

      const deleteProductCommand = Container.get(DeleteProductCommand);
      await deleteProductCommand.execute(productId, user.sub, force);

      return successResponse(
        c,
        {
          productId,
          force,
        },
        force ? 'Product permanently deleted' : 'Product soft deleted'
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Product already deleted') {
          return errorResponse(c, 'Product already deleted', 'PRODUCT_ALREADY_DELETED', 400);
        }
      }
      return errorResponse(c, 'Failed to delete product', 'PRODUCT_DELETE_FAILED', 400, error);
    }
  }
);

// Restore soft-deleted product (owner only)
productRoutes.post('/products/:id/restore', async c => {
  try {
    const user = c.get('user');
    const productId = c.req.param('id');

    // Strict IDOR Check: Only OWNER can restore. Admin CANNOT restore user products.
    const getProductQuery = Container.get(GetProductQuery);
    const existingProduct = await getProductQuery.executeWithDeleted(productId);

    if (!existingProduct) {
      return errorResponse(c, 'Product not found', 'PRODUCT_NOT_FOUND', 404);
    }

    if (existingProduct.ownerId !== user.sub) {
      return errorResponse(
        c,
        'Access denied. Only owner can restore product.',
        'ACCESS_DENIED',
        403
      );
    }

    const restoreProductCommand = Container.get(RestoreProductCommand);
    const restoredProduct = await restoreProductCommand.execute(productId, user.sub);

    return successResponse(c, { product: restoredProduct }, 'Product restored successfully');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Product not found or access denied') {
        return errorResponse(c, 'Product not found or access denied', 'PRODUCT_NOT_FOUND', 404);
      }
      if (error.message === 'Product is already active') {
        return errorResponse(c, 'Product is already active', 'PRODUCT_ALREADY_ACTIVE', 400);
      }
    }
    return errorResponse(c, 'Failed to restore product', 'PRODUCT_RESTORE_FAILED', 500, error);
  }
});

export default productRoutes;
