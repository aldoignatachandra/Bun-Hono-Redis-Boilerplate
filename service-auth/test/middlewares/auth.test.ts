import { describe, expect, it, mock } from 'bun:test';
import type { Context } from 'hono';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const middlewarePromise = import('../../src/middlewares/auth');
const configPromise = import('../../src/config/loader');
const connectionPromise = import('../../src/db/connection');

type JsonFn = (data: unknown, status?: number) => unknown;

const createContext = (
  authorization?: string,
  getValues: Record<string, unknown> = {}
): Context => {
  const json = mock((data: unknown, status?: number) => ({ data, status })) as unknown as JsonFn;
  const set = mock((_key: string, _value: unknown) => undefined);
  const get = mock((key: string) => getValues[key]);
  return {
    req: {
      header: (key: string) => (key === 'authorization' ? authorization : undefined),
    },
    json,
    set,
    get,
  } as unknown as Context;
};

const getDbRef = async () => {
  const { drizzleDb } = await connectionPromise;
  return drizzleDb as unknown as {
    query: {
      userSessions: {
        findFirst: (args: unknown) => Promise<unknown>;
      };
    };
  };
};

describe('auth middleware', () => {
  it('rejects missing authorization header', async () => {
    const c = createContext();
    const next = mock(async () => undefined);
    const { auth } = await middlewarePromise;
    await auth(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('rejects invalid token', async () => {
    const c = createContext('Bearer invalid');
    const next = mock(async () => undefined);
    const { auth } = await middlewarePromise;
    await auth(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('rejects missing jti', async () => {
    const { configLoader } = await configPromise;
    const { auth } = await middlewarePromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', role: 'USER' }, secret);
    const c = createContext(`Bearer ${token}`);
    const next = mock(async () => undefined);
    await auth(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('rejects missing session', async () => {
    const { configLoader } = await configPromise;
    const { auth } = await middlewarePromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const c = createContext(`Bearer ${token}`);
    const next = mock(async () => undefined);
    const findFirst = mock(async () => null);
    const dbRef = await getDbRef();
    dbRef.query = { userSessions: { findFirst } };
    await auth(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('accepts valid token and session', async () => {
    const { configLoader } = await configPromise;
    const { auth } = await middlewarePromise;
    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign({ sub: 'u1', jti: 's1', email: 'a@b.com', role: 'USER' }, secret);
    const c = createContext(`Bearer ${token}`);
    const next = mock(async () => undefined);
    const findFirst = mock(async () => ({ id: 's1' }));
    const dbRef = await getDbRef();
    dbRef.query = { userSessions: { findFirst } };
    await auth(c, next);
    expect((c.set as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(1);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('blocks when role is incorrect', async () => {
    const c = createContext(undefined, { user: { role: 'USER' } });
    const next = mock(async () => undefined);
    const { requireRole } = await middlewarePromise;
    await requireRole('ADMIN')(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(403);
  });

  it('passes when role matches', async () => {
    const c = createContext(undefined, { user: { role: 'ADMIN' } });
    const next = mock(async () => undefined);
    const { requireRole } = await middlewarePromise;
    await requireRole('ADMIN')(c, next);
    expect(next).toHaveBeenCalled();
  });
});
