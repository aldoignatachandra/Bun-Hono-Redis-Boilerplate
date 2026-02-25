import { describe, expect, it, mock, spyOn } from 'bun:test';
import type { Context } from 'hono';
import * as passwordHelper from '../../src/helpers/password';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const middlewarePromise = import('../../src/middlewares/basic-auth');
const connectionPromise = import('../../src/db/connection');

type JsonFn = (data: unknown, status?: number) => unknown;

const createContext = (authorization?: string): Context => {
  const json = mock((data: unknown, status?: number) => ({ data, status })) as unknown as JsonFn;
  const set = mock((_key: string, _value: unknown) => undefined);
  return {
    req: {
      header: (key: string) => (key === 'Authorization' ? authorization : undefined),
    },
    json,
    set,
  } as unknown as Context;
};

const getDbRef = async () => {
  const { drizzleDb } = await connectionPromise;
  return drizzleDb as unknown as {
    query: {
      users: {
        findFirst: (args: unknown) => Promise<unknown>;
      };
    };
  };
};

describe('basic auth middleware', () => {
  it('rejects missing header', async () => {
    const c = createContext();
    const next = mock(async () => undefined);
    const { basicAuthMiddleware } = await middlewarePromise;
    await basicAuthMiddleware(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('rejects invalid credentials format', async () => {
    const c = createContext('Basic invalid');
    const next = mock(async () => undefined);
    const { basicAuthMiddleware } = await middlewarePromise;
    await basicAuthMiddleware(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('rejects missing user', async () => {
    const creds = Buffer.from('user:pass').toString('base64');
    const c = createContext(`Basic ${creds}`);
    const next = mock(async () => undefined);
    const dbRef = await getDbRef();
    dbRef.query = { users: { findFirst: mock(async () => null) } };
    const { basicAuthMiddleware } = await middlewarePromise;
    await basicAuthMiddleware(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('rejects password mismatch', async () => {
    const creds = Buffer.from('user:pass').toString('base64');
    const c = createContext(`Basic ${creds}`);
    const next = mock(async () => undefined);
    const dbRef = await getDbRef();
    dbRef.query = { users: { findFirst: mock(async () => ({ id: '1', password: 'hash' })) } };
    const compareSpy = spyOn(passwordHelper, 'comparePassword').mockResolvedValue(false);
    const { basicAuthMiddleware } = await middlewarePromise;
    await basicAuthMiddleware(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
    compareSpy.mockRestore();
  });

  it('accepts valid credentials', async () => {
    const creds = Buffer.from('user:pass').toString('base64');
    const c = createContext(`Basic ${creds}`);
    const next = mock(async () => undefined);
    const dbRef = await getDbRef();
    dbRef.query = {
      users: {
        findFirst: mock(async () => ({
          id: '1',
          email: 'user@example.com',
          username: 'user',
          name: 'User',
          role: 'USER',
          password: 'hash',
        })),
      },
    };
    const compareSpy = spyOn(passwordHelper, 'comparePassword').mockResolvedValue(true);
    const { basicAuthMiddleware } = await middlewarePromise;
    await basicAuthMiddleware(c, next);
    expect(next).toHaveBeenCalled();
    expect((c.set as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(1);
    compareSpy.mockRestore();
  });
});
