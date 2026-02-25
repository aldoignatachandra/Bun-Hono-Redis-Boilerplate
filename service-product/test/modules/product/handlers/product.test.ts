import { describe, expect, it, mock } from 'bun:test';
import jwt from 'jsonwebtoken';
import { Container } from 'typedi';
import { configLoader } from '../../../../src/config/loader';
import { CreateProductCommand } from '../../../../src/modules/product/repositories/commands/CreateProductCommand';
import { DeleteProductCommand } from '../../../../src/modules/product/repositories/commands/DeleteProductCommand';
import { RestoreProductCommand } from '../../../../src/modules/product/repositories/commands/RestoreProductCommand';
import { UpdateProductCommand } from '../../../../src/modules/product/repositories/commands/UpdateProductCommand';
import { GetProductQuery } from '../../../../src/modules/product/repositories/queries/GetProductQuery';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3200';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const routesPromise = import('../../../../src/modules/product/handlers/product');

describe('product handlers', () => {
  const baseProduct = {
    id: 'p1',
    name: 'Item',
    price: 10,
    ownerId: 'u1',
    stock: 1,
    hasVariant: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null as Date | null,
  };

  it('creates product successfully', async () => {
    const createProductCommand = {
      execute: mock(async () => baseProduct),
    };

    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === CreateProductCommand) return createProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Item', price: 10 }),
    });
    const body = (await res.json()) as { success: boolean };
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);

    Container.get = originalGet;
  });

  it('returns validation error for invalid create payload', async () => {
    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ price: 10 }),
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when product is not found', async () => {
    const getProductQuery = {
      execute: mock(async () => null),
      executeWithDeleted: mock(async () => null),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');

    Container.get = originalGet;
  });

  it('returns 403 when non-admin accesses another user product', async () => {
    const getProductQuery = {
      execute: mock(async () => ({ ...baseProduct, ownerId: 'u2' })),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('ACCESS_DENIED');

    Container.get = originalGet;
  });

  it('returns 200 when admin accesses any product', async () => {
    const getProductQuery = {
      execute: mock(async () => ({ ...baseProduct, ownerId: 'u2' })),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'admin', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await productRoutes.request('/products/p1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    Container.get = originalGet;
  });

  it('returns 404 when updating missing product', async () => {
    const getProductQuery = {
      execute: mock(async () => null),
    };
    const updateProductCommand = {
      execute: mock(async () => baseProduct),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === UpdateProductCommand) return updateProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');

    Container.get = originalGet;
  });

  it('returns 403 when updating a product not owned', async () => {
    const getProductQuery = {
      execute: mock(async () => ({ ...baseProduct, ownerId: 'u2' })),
    };
    const updateProductCommand = {
      execute: mock(async () => baseProduct),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === UpdateProductCommand) return updateProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Updated' }),
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('ACCESS_DENIED');

    Container.get = originalGet;
  });

  it('updates product successfully', async () => {
    const getProductQuery = {
      execute: mock(async () => baseProduct),
    };
    const updateProductCommand = {
      execute: mock(async () => ({ ...baseProduct, name: 'Updated' })),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === UpdateProductCommand) return updateProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(200);

    Container.get = originalGet;
  });

  it('returns 404 when deleting missing product', async () => {
    const getProductQuery = {
      executeWithDeleted: mock(async () => null),
    };
    const deleteProductCommand = {
      execute: mock(async () => undefined),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === DeleteProductCommand) return deleteProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');

    Container.get = originalGet;
  });

  it('returns 403 when deleting a product not owned', async () => {
    const getProductQuery = {
      executeWithDeleted: mock(async () => ({ ...baseProduct, ownerId: 'u2' })),
    };
    const deleteProductCommand = {
      execute: mock(async () => undefined),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === DeleteProductCommand) return deleteProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('ACCESS_DENIED');

    Container.get = originalGet;
  });

  it('returns 400 when deleting already deleted product', async () => {
    const getProductQuery = {
      executeWithDeleted: mock(async () => baseProduct),
    };
    const deleteProductCommand = {
      execute: mock(async () => {
        throw new Error('Product already deleted');
      }),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === DeleteProductCommand) return deleteProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('PRODUCT_ALREADY_DELETED');

    Container.get = originalGet;
  });

  it('deletes product successfully', async () => {
    const getProductQuery = {
      executeWithDeleted: mock(async () => baseProduct),
    };
    const deleteProductCommand = {
      execute: mock(async () => undefined),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === DeleteProductCommand) return deleteProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1?force=true', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    Container.get = originalGet;
  });

  it('returns 404 when restoring missing product', async () => {
    const getProductQuery = {
      executeWithDeleted: mock(async () => null),
    };
    const restoreProductCommand = {
      execute: mock(async () => undefined),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === RestoreProductCommand) return restoreProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1/restore', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');

    Container.get = originalGet;
  });

  it('returns 403 when restoring a product not owned', async () => {
    const getProductQuery = {
      executeWithDeleted: mock(async () => ({ ...baseProduct, ownerId: 'u2' })),
    };
    const restoreProductCommand = {
      execute: mock(async () => undefined),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === RestoreProductCommand) return restoreProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1/restore', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('ACCESS_DENIED');

    Container.get = originalGet;
  });

  it('returns 404 when restore command says not found or denied', async () => {
    const getProductQuery = {
      executeWithDeleted: mock(async () => baseProduct),
    };
    const restoreProductCommand = {
      execute: mock(async () => {
        throw new Error('Product not found or access denied');
      }),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === RestoreProductCommand) return restoreProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1/restore', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('PRODUCT_NOT_FOUND');

    Container.get = originalGet;
  });

  it('returns 400 when restoring already active product', async () => {
    const getProductQuery = {
      executeWithDeleted: mock(async () => baseProduct),
    };
    const restoreProductCommand = {
      execute: mock(async () => {
        throw new Error('Product is already active');
      }),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === RestoreProductCommand) return restoreProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1/restore', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(400);
    expect(body.error.code).toBe('PRODUCT_ALREADY_ACTIVE');

    Container.get = originalGet;
  });

  it('restores product successfully', async () => {
    const getProductQuery = {
      executeWithDeleted: mock(async () => baseProduct),
    };
    const restoreProductCommand = {
      execute: mock(async () => baseProduct),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetProductQuery) return getProductQuery;
      if (token === RestoreProductCommand) return restoreProductCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: productRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const res = await productRoutes.request('/products/p1/restore', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    Container.get = originalGet;
  });
});
