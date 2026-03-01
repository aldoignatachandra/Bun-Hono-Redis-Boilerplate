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
  const baseUrl = process.env.USER_SERVICE_URL || 'http://localhost:3101';
  return [
    { url: baseUrl, description: 'Base URL' },
    { url: 'https://staging-user.example.com', description: 'Staging' },
    { url: 'https://user.example.com', description: 'Production' },
  ];
};

export const getOpenApiSpec = (): OpenApiSpec => ({
  openapi: '3.0.3',
  info: {
    title: 'User Service',
    version: '1.0.0',
    description: 'User management and admin APIs',
  },
  servers: buildServers(),
  tags: [
    { name: 'Health', description: 'Service health endpoints' },
    { name: 'Admin', description: 'Admin user management' },
    { name: 'Internal', description: 'Internal service-to-service endpoints' },
    { name: 'Profile', description: 'User profile endpoints' },
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
          service: { type: 'string', example: 'user-service' },
          environment: { type: 'string', example: configLoader.getEnvironment() },
          database: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      AdminHealthData: {
        type: 'object',
        properties: {
          service: { type: 'string', example: 'user-service' },
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
      UserSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          username: { type: 'string' },
          name: { type: 'string', nullable: true },
          role: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      UserCreateResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      OldestUserResponse: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          username: { type: 'string' },
          name: { type: 'string', nullable: true },
          role: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateUserRequest: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          username: { type: 'string' },
          name: { type: 'string', nullable: true },
          password: { type: 'string' },
          role: { type: 'string', enum: ['ADMIN', 'USER'] },
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
    '/api/internal/users/oldest': {
      get: {
        tags: ['Internal'],
        operationId: 'internal_oldest_user',
        security: [{ BasicAuth: [] }],
        parameters: [
          {
            name: 'role',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['ADMIN', 'USER'] },
          },
        ],
        responses: {
          '200': {
            description: 'Oldest user',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    { properties: { data: { $ref: '#/components/schemas/OldestUserResponse' } } },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'Invalid role',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '404': {
            description: 'User not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/admin/users': {
      post: {
        tags: ['Admin'],
        operationId: 'users_create',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateUserRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'User created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    { properties: { data: { $ref: '#/components/schemas/UserCreateResponse' } } },
                  ],
                },
              },
            },
          },
          '400': {
            description: 'Invalid input',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '403': {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
      get: {
        tags: ['Admin'],
        operationId: 'users_list',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
          { name: 'includeDeleted', in: 'query', required: false, schema: { type: 'boolean' } },
          { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Users list',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '403': {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '500': {
            description: 'Failed to fetch users',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/admin/users/{id}': {
      get: {
        tags: ['Admin'],
        operationId: 'users_get',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'includeDeleted', in: 'query', required: false, schema: { type: 'boolean' } },
        ],
        responses: {
          '200': {
            description: 'User fetched',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '404': {
            description: 'User not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
      delete: {
        tags: ['Admin'],
        operationId: 'users_delete',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'force', in: 'query', required: false, schema: { type: 'boolean' } },
        ],
        responses: {
          '200': {
            description: 'User deleted',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '400': {
            description: 'User already deleted',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '403': {
            description: 'Forbidden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '404': {
            description: 'User not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/admin/users/{id}/restore': {
      post: {
        tags: ['Admin'],
        operationId: 'users_restore',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'User restored',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '400': {
            description: 'User already active',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '404': {
            description: 'User not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/me': {
      get: {
        tags: ['Profile'],
        operationId: 'users_me',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'User profile',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '404': {
            description: 'User not found',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
  },
});
