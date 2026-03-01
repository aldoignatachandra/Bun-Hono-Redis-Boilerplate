import { configLoader } from './config/loader';

type OpenApiSpec = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{ name: string; description: string }>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  paths: Record<string, unknown>;
};

const buildServers = () => {
  const baseUrl = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3102';
  return [
    { url: baseUrl, description: 'Base URL' },
    { url: 'https://staging-product.example.com', description: 'Staging' },
    { url: 'https://product.example.com', description: 'Production' },
  ];
};

export const getOpenApiSpec = (): OpenApiSpec => ({
  openapi: '3.0.3',
  info: {
    title: 'Product Service',
    version: '1.0.0',
    description: 'Product management APIs',
  },
  servers: buildServers(),
  tags: [
    { name: 'Health', description: 'Service health endpoints' },
    { name: 'Admin', description: 'Admin/system endpoints' },
    { name: 'Products', description: 'Product management endpoints' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      BasicAuth: {
        type: 'http',
        scheme: 'basic',
      },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'object', nullable: true },
          meta: { type: 'object', nullable: true },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              details: {},
            },
          },
        },
      },
      HealthData: {
        type: 'object',
        properties: {
          service: { type: 'string', example: 'product-service' },
          environment: { type: 'string', example: configLoader.getEnvironment() },
          database: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      AdminHealthData: {
        type: 'object',
        properties: {
          service: { type: 'string', example: 'product-service' },
          mode: { type: 'string', example: 'admin' },
          config: {
            type: 'object',
            properties: {
              db: { type: 'string' },
              redis: { type: 'string' },
            },
          },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          ownerId: { type: 'string' },
          stock: { type: 'number' },
          hasVariant: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          deletedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ProductAttribute: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          values: { type: 'array', items: { type: 'string' } },
          displayOrder: { type: 'number' },
        },
      },
      ProductVariant: {
        type: 'object',
        properties: {
          sku: { type: 'string' },
          price: { type: 'number', nullable: true },
          stock: { type: 'number' },
          isActive: { type: 'boolean' },
          attributeValues: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
      CreateProductRequest: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name: { type: 'string' },
          price: { type: 'number' },
          stock: { type: 'number' },
          attributes: { type: 'array', items: { $ref: '#/components/schemas/ProductAttribute' } },
          variants: { type: 'array', items: { $ref: '#/components/schemas/ProductVariant' } },
        },
      },
      UpdateProductRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number' },
          stock: { type: 'number' },
          attributes: { type: 'array', items: { $ref: '#/components/schemas/ProductAttribute' } },
          variants: { type: 'array', items: { $ref: '#/components/schemas/ProductVariant' } },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        operationId: 'health_status',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    { properties: { data: { $ref: '#/components/schemas/HealthData' } } },
                  ],
                },
              },
            },
          },
          '503': {
            description: 'Service is unhealthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/admin/health': {
      get: {
        tags: ['Admin'],
        operationId: 'admin_health',
        security: [{ BasicAuth: [] }],
        responses: {
          '200': {
            description: 'Admin health',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    { properties: { data: { $ref: '#/components/schemas/AdminHealthData' } } },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/products': {
      post: {
        tags: ['Products'],
        operationId: 'products_create',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateProductRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Product created',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '400': {
            description: 'Invalid input',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
      get: {
        tags: ['Products'],
        operationId: 'products_list',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'includeDeleted', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'onlyDeleted', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'minPrice', in: 'query', required: false, schema: { type: 'number' } },
          { name: 'maxPrice', in: 'query', required: false, schema: { type: 'number' } },
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
        ],
        responses: {
          '200': {
            description: 'Products list',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '500': {
            description: 'Failed to fetch products',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        operationId: 'products_get',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'includeDeleted', in: 'query', required: false, schema: { type: 'boolean' } },
        ],
        responses: {
          '200': {
            description: 'Product fetched',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '403': {
            description: 'Access denied',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '404': {
            description: 'Product not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
      patch: {
        tags: ['Products'],
        operationId: 'products_update',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateProductRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Product updated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '400': {
            description: 'Validation failed',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '403': {
            description: 'Access denied',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '404': {
            description: 'Product not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
      delete: {
        tags: ['Products'],
        operationId: 'products_delete',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'force', in: 'query', required: false, schema: { type: 'boolean' } },
        ],
        responses: {
          '200': {
            description: 'Product deleted',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '400': {
            description: 'Product already deleted',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '403': {
            description: 'Access denied',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '404': {
            description: 'Product not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/products/{id}/restore': {
      post: {
        tags: ['Products'],
        operationId: 'products_restore',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'Product restored',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '400': {
            description: 'Product already active',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '403': {
            description: 'Access denied',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '404': {
            description: 'Product not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
  },
});
