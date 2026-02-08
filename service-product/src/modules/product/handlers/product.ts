import { auth } from '../../../middlewares/auth';
import { Hono } from 'hono';
import { Container } from 'typedi';
import { CreateProductCommand } from '../repositories/commands/CreateProductCommand';
import { DeleteProductCommand } from '../repositories/commands/DeleteProductCommand';
import { RestoreProductCommand } from '../repositories/commands/RestoreProductCommand';
import { UpdateProductCommand } from '../repositories/commands/UpdateProductCommand';
import { GetProductQuery } from '../repositories/queries/GetProductQuery';
import { CreateProductSchema, UpdateProductSchema } from '../domain/product';

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

    const createProductCommand = Container.get(CreateProductCommand);
    const product = await createProductCommand.execute({
      name: validatedData.name,
      price: validatedData.price,
      ownerId: user.sub,
    });

    return c.json(product);
  } catch (error) {
    return c.text('Failed to create product', 400);
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

    return c.json({
      data: products,
      meta: {
        includeDeleted,
        onlyDeleted,
        search,
        priceRange: { min: minPrice, max: maxPrice },
        page,
        limit,
        count: products.length,
      },
    });
  } catch (error) {
    return c.text('Failed to fetch products', 500);
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
      return c.text('Product not found', 404);
    }

    // Check ownership for non-admin users
    if (product.ownerId !== user.sub && user.role !== 'ADMIN') {
      return c.text('Access denied', 403);
    }

    return c.json(product);
  } catch (error) {
    return c.text('Failed to fetch product', 500);
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

    return c.json(product);
  } catch (error) {
    return c.text('Failed to update product', 400);
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

    return c.json({
      message: force ? 'Product permanently deleted' : 'Product soft deleted',
      productId,
      force,
    });
  } catch (error) {
    return c.text('Failed to delete product', 400);
  }
});

// Restore soft-deleted product (owner only)
productRoutes.post('/products/:id/restore', async c => {
  try {
    const user = c.get('user');
    const productId = c.req.param('id');

    const restoreProductCommand = Container.get(RestoreProductCommand);
    const restoredProduct = await restoreProductCommand.execute(productId, user.sub);

    return c.json({
      message: 'Product restored successfully',
      product: restoredProduct,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Product not found or access denied') {
      return c.text('Product not found or access denied', 404);
    }
    return c.text('Failed to restore product', 500);
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
      return c.text('Search query is required', 400);
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

    return c.json({
      products,
      meta: {
        query,
        includeDeleted,
        onlyDeleted,
        count: products.length,
      },
    });
  } catch (error) {
    return c.text('Failed to search products', 500);
  }
});

export default productRoutes;
