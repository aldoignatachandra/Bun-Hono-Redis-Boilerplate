import { Hono } from 'hono';
import { Container } from 'typedi';
import { errorResponse, successResponse } from '../../../helpers/api-response';
import { getRequestMetadata } from '../../../helpers/request-metadata';
import { auth } from '../../../middlewares/auth';
import { CreateProductSchema, UpdateProductSchema } from '../domain/product';
import { CreateProductCommand } from '../repositories/commands/CreateProductCommand';
import { DeleteProductCommand } from '../repositories/commands/DeleteProductCommand';
import { RestoreProductCommand } from '../repositories/commands/RestoreProductCommand';
import { UpdateProductCommand } from '../repositories/commands/UpdateProductCommand';
import { GetProductQuery } from '../repositories/queries/GetProductQuery';

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

// Authentication middleware for all product routes
productRoutes.use('/products/*', auth);

// Create product
productRoutes.post('/products', async c => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const validatedData = CreateProductSchema.parse(body);
    const metadata = getRequestMetadata(c);

    const createProductCommand = Container.get(CreateProductCommand);
    const product = await createProductCommand.execute(
      {
        name: validatedData.name,
        price: validatedData.price,
        ownerId: user.sub,
      },
      metadata
    );

    return successResponse(c, product, 'Product created successfully', 201);
  } catch (error) {
    return errorResponse(c, 'Failed to create product', 'PRODUCT_CREATE_FAILED', 400, error);
  }
});

// Get user's products with paranoid support
productRoutes.get('/products', async c => {
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

    const products = await getProductQuery.executeWithFilters({
      ownerId: user.sub,
      search,
      minPrice,
      maxPrice,
      includeDeleted,
      onlyDeleted,
      limit,
      offset,
    });

    return successResponse(c, products, 'Products fetched successfully', 200, {
      includeDeleted,
      onlyDeleted,
      search,
      priceRange: { min: minPrice, max: maxPrice },
      page,
      limit,
      count: products.length,
    });
  } catch (error) {
    return errorResponse(c, 'Failed to fetch products', 'PRODUCT_FETCH_FAILED', 500, error);
  }
});

// Get product by ID with paranoid support
productRoutes.get('/products/:id', async c => {
  try {
    const user = c.get('user');
    const productId = c.req.param('id');
    const includeDeleted = c.req.query('includeDeleted') === 'true';

    const getProductQuery = Container.get(GetProductQuery);

    const product = includeDeleted
      ? await getProductQuery.executeWithDeleted(productId)
      : await getProductQuery.execute(productId);

    if (!product) {
      return errorResponse(c, 'Product not found', 'PRODUCT_NOT_FOUND', 404);
    }

    // Check ownership for non-admin users
    if (product.ownerId !== user.sub && user.role !== 'ADMIN') {
      return errorResponse(c, 'Access denied', 'ACCESS_DENIED', 403);
    }

    return successResponse(c, product, 'Product fetched successfully');
  } catch (error) {
    return errorResponse(c, 'Failed to fetch product', 'PRODUCT_FETCH_FAILED', 500, error);
  }
});

// Update product (owner only)
productRoutes.patch('/products/:id', async c => {
  try {
    const user = c.get('user');
    const productId = c.req.param('id');
    const body = await c.req.json();
    const validatedData = UpdateProductSchema.parse(body);

    const updateProductCommand = Container.get(UpdateProductCommand);
    const product = await updateProductCommand.execute(productId, validatedData, user.sub);

    return successResponse(c, product, 'Product updated successfully');
  } catch (error) {
    return errorResponse(c, 'Failed to update product', 'PRODUCT_UPDATE_FAILED', 400, error);
  }
});

// Delete product (owner only) with paranoid support
productRoutes.delete('/products/:id', async c => {
  try {
    const user = c.get('user');
    const productId = c.req.param('id');
    const force = c.req.query('force') === 'true';

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
    return errorResponse(c, 'Failed to delete product', 'PRODUCT_DELETE_FAILED', 400, error);
  }
});

// Restore soft-deleted product (owner only)
productRoutes.post('/products/:id/restore', async c => {
  try {
    const user = c.get('user');
    const productId = c.req.param('id');

    const restoreProductCommand = Container.get(RestoreProductCommand);
    const restoredProduct = await restoreProductCommand.execute(productId, user.sub);

    return successResponse(c, { product: restoredProduct }, 'Product restored successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Product not found or access denied') {
      return errorResponse(c, 'Product not found or access denied', 'PRODUCT_NOT_FOUND', 404);
    }
    return errorResponse(c, 'Failed to restore product', 'PRODUCT_RESTORE_FAILED', 500, error);
  }
});

// Search products with paranoid support
productRoutes.get('/products/search', async c => {
  try {
    const user = c.get('user');
    const query = c.req.query('q');
    const includeDeleted = c.req.query('includeDeleted') === 'true';
    const onlyDeleted = c.req.query('onlyDeleted') === 'true';

    if (!query) {
      return errorResponse(c, 'Search query is required', 'MISSING_SEARCH_QUERY', 400);
    }

    const getProductQuery = Container.get(GetProductQuery);

    let products;
    if (onlyDeleted) {
      products = await getProductQuery.executeSearchWithDeleted(query);
    } else if (includeDeleted) {
      products = await getProductQuery.executeSearchWithDeleted(query);
    } else {
      products = await getProductQuery.executeSearch(query);
    }

    // Filter by ownership for non-admin users
    if (user.role !== 'ADMIN') {
      products = products.filter(product => product.ownerId === user.sub);
    }

    return successResponse(c, products, 'Products searched successfully', 200, {
      query,
      includeDeleted,
      onlyDeleted,
      count: products.length,
    });
  } catch (error) {
    return errorResponse(c, 'Failed to search products', 'PRODUCT_SEARCH_FAILED', 500, error);
  }
});

export default productRoutes;
