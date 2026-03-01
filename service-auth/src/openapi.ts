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
  const baseUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3100';
  return [
    { url: baseUrl, description: 'Base URL' },
    { url: 'https://staging-auth.example.com', description: 'Staging' },
    { url: 'https://auth.example.com', description: 'Production' },
  ];
};

export const getOpenApiSpec = (): OpenApiSpec => ({
  openapi: '3.0.3',
  info: {
    title: 'Auth Service',
    version: '1.0.0',
    description: 'Authentication and session management APIs',
  },
  servers: buildServers(),
  tags: [
    { name: 'Health', description: 'Service health endpoints' },
    { name: 'Auth', description: 'Authentication endpoints' },
    { name: 'Admin', description: 'Admin/system endpoints' },
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
          service: { type: 'string', example: 'auth-service' },
          environment: { type: 'string', example: configLoader.getEnvironment() },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      AdminHealthData: {
        type: 'object',
        properties: {
          service: { type: 'string', example: 'auth-service' },
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
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              email: { type: 'string' },
              username: { type: 'string' },
              name: { type: 'string' },
              role: { type: 'string' },
            },
          },
        },
      },
      GatewayResponse: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          services: {
            type: 'object',
            properties: {
              user: { type: 'string' },
              product: { type: 'string' },
            },
          },
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
    '/auth/login': {
      post: {
        tags: ['Auth'],
        operationId: 'auth_login',
        security: [{ BasicAuth: [] }],
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiSuccess' },
                    { properties: { data: { $ref: '#/components/schemas/LoginResponse' } } },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        operationId: 'auth_logout',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logged out',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ApiSuccess' } },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
          '429': {
            description: 'Rate limited',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
          },
        },
      },
    },
    '/': {
      get: {
        tags: ['Health'],
        operationId: 'gateway_root',
        responses: {
          '200': {
            description: 'Gateway response',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/GatewayResponse' } },
            },
          },
        },
      },
    },
  },
});
