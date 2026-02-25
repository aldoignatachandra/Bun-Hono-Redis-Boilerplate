import { describe, expect, it, mock } from 'bun:test';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3300';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

let oldestUsers = [
  {
    id: 'u1',
    email: 'user@example.com',
    username: 'user',
    name: 'User',
    role: 'USER',
    createdAt: new Date(),
  },
];

const selectMock = () => ({
  from: () => ({
    where: () => ({
      orderBy: () => ({
        limit: () => oldestUsers,
      }),
    }),
  }),
});

mock.module('../../../../src/db/connection', () => ({
  drizzleDb: {
    select: selectMock,
  },
}));

const routesPromise = import('../../../../src/modules/user/handlers/internal');

describe('internal handlers', () => {
  it('returns oldest user', async () => {
    oldestUsers = [
      {
        id: 'u1',
        email: 'user@example.com',
        username: 'user',
        name: 'User',
        role: 'USER',
        createdAt: new Date(),
      },
    ];
    const { default: internalRoutes } = await routesPromise;
    const credentials = Buffer.from(
      `${process.env.SYSTEM_USER}:${process.env.SYSTEM_PASS}`
    ).toString('base64');
    const res = await internalRoutes.request('/users/oldest?role=USER', {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const body = (await res.json()) as { success: boolean };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 400 for invalid role', async () => {
    const { default: internalRoutes } = await routesPromise;
    const credentials = Buffer.from(
      `${process.env.SYSTEM_USER}:${process.env.SYSTEM_PASS}`
    ).toString('base64');
    const res = await internalRoutes.request('/users/oldest?role=INVALID', {
      headers: { Authorization: `Basic ${credentials}` },
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when no user found', async () => {
    oldestUsers = [];
    const { default: internalRoutes } = await routesPromise;
    const credentials = Buffer.from(
      `${process.env.SYSTEM_USER}:${process.env.SYSTEM_PASS}`
    ).toString('base64');
    const res = await internalRoutes.request('/users/oldest?role=USER', {
      headers: { Authorization: `Basic ${credentials}` },
    });
    expect(res.status).toBe(404);
  });
});
