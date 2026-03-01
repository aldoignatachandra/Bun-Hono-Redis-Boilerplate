import { describe, expect, it, mock } from 'bun:test';
import jwt from 'jsonwebtoken';
import { Container } from 'typedi';
import { configLoader } from '../../../../src/config/loader';
import { CreateUserCommand } from '../../../../src/modules/user/repositories/commands/CreateUserCommand';
import { DeleteUserCommand } from '../../../../src/modules/user/repositories/commands/DeleteUserCommand';
import { RestoreUserCommand } from '../../../../src/modules/user/repositories/commands/RestoreUserCommand';
import { GetUserQuery } from '../../../../src/modules/user/repositories/queries/GetUserQuery';
import { UserRepository } from '../../../../src/modules/user/repositories/UserRepository';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3300';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

mock.module('../../../../src/db/connection', () => ({
  drizzleDb: {
    query: {
      userSessions: {
        findFirst: mock(async () => ({ id: 's1' })),
      },
    },
  },
}));

mock.module('../../../../src/helpers/redis', () => ({
  getRedisClient: () => ({
    status: 'mock',
    xadd: mock(async () => '1-0'),
    xgroup: mock(async () => 'OK'),
    xreadgroup: mock(async () => null),
    xack: mock(async () => 1),
    quit: mock(async () => 'OK'),
  }),
}));

const routesPromise = import('../../../../src/modules/user/handlers/user');

describe('user handlers', () => {
  it('creates user successfully', async () => {
    const createUserCommand = {
      execute: mock(async () => ({
        id: 'u2',
        email: 'new@example.com',
        role: 'USER',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };

    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === CreateUserCommand) return createUserCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: userRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await userRoutes.request('/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: 'new@example.com',
        username: 'newuser',
        name: 'New User',
        password: 'StrongPass1!',
      }),
    });
    const body = (await res.json()) as { success: boolean };
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);

    Container.get = originalGet;
  });

  it('returns user list for admin', async () => {
    const userRepository = {
      findAll: mock(async () => ({ data: [], total: 0 })),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === UserRepository) return userRepository;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: userRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await userRoutes.request('/admin/users?page=1&limit=10', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { success: boolean };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    Container.get = originalGet;
  });

  it('returns current user profile', async () => {
    const getUserQuery = {
      execute: mock(async () => ({
        id: 'u1',
        email: 'a@b.com',
        username: 'user',
        name: 'User',
        role: 'ADMIN',
      })),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetUserQuery) return getUserQuery;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: userRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await userRoutes.request('/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { success: boolean };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    Container.get = originalGet;
  });

  it('returns 404 when admin user id is missing', async () => {
    const getUserQuery = {
      execute: mock(async () => null),
      executeWithDeleted: mock(async () => null),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetUserQuery) return getUserQuery;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: userRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await userRoutes.request('/admin/users/u1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('USER_NOT_FOUND');

    Container.get = originalGet;
  });

  it('returns user when includeDeleted is true', async () => {
    const getUserQuery = {
      execute: mock(async () => null),
      executeWithDeleted: mock(async () => ({
        id: 'u1',
        email: 'a@b.com',
        username: 'user',
        name: 'User',
        role: 'ADMIN',
      })),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetUserQuery) return getUserQuery;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: userRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await userRoutes.request('/admin/users/u1?includeDeleted=true', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    Container.get = originalGet;
  });

  it('returns 404 when deleting missing user', async () => {
    const deleteUserCommand = {
      execute: mock(async () => {
        throw new Error('User not found');
      }),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === DeleteUserCommand) return deleteUserCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: userRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await userRoutes.request('/admin/users/u2', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('USER_NOT_FOUND');

    Container.get = originalGet;
  });

  it('returns 403 when deleting self', async () => {
    const deleteUserCommand = {
      execute: mock(async () => {
        throw new Error('Cannot delete yourself');
      }),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === DeleteUserCommand) return deleteUserCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: userRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await userRoutes.request('/admin/users/u1', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(403);
    expect(body.error.code).toBe('USER_DELETE_FORBIDDEN');

    Container.get = originalGet;
  });

  it('returns 404 when restoring missing user', async () => {
    const restoreUserCommand = {
      execute: mock(async () => {
        throw new Error('User not found');
      }),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === RestoreUserCommand) return restoreUserCommand;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: userRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await userRoutes.request('/admin/users/u2/restore', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('USER_NOT_FOUND');

    Container.get = originalGet;
  });

  it('returns 404 when current user is not found', async () => {
    const getUserQuery = {
      execute: mock(async () => null),
    };
    const originalGet = Container.get;
    Container.get = mock((token: unknown) => {
      if (token === GetUserQuery) return getUserQuery;
      return undefined;
    }) as unknown as typeof Container.get;

    const { default: userRoutes } = await routesPromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'ADMIN' }, secret);
    const res = await userRoutes.request('/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json()) as { error: { code: string } };
    expect(res.status).toBe(404);
    expect(body.error.code).toBe('USER_NOT_FOUND');

    Container.get = originalGet;
  });
});
