import { describe, expect, it, mock, spyOn } from 'bun:test';
import type { Context } from 'hono';
import type { Config } from '../../src/config/loader';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const configPromise = import('../../src/config/loader');
const middlewarePromise = import('../../src/middlewares/system-auth');

type JsonFn = (data: unknown, status?: number) => unknown;

const createContext = (authorization?: string): Context => {
  const json = mock((data: unknown, status?: number) => ({ data, status })) as unknown as JsonFn;
  return {
    req: {
      header: (key: string) => (key === 'Authorization' ? authorization : undefined),
    },
    json,
  } as unknown as Context;
};

describe('system auth middleware', () => {
  it('rejects missing header', async () => {
    const c = createContext();
    const next = mock(async () => undefined);
    const { systemAuthMiddleware } = await middlewarePromise;
    await systemAuthMiddleware(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('rejects invalid format', async () => {
    const c = createContext('Basic invalid');
    const next = mock(async () => undefined);
    const { systemAuthMiddleware } = await middlewarePromise;
    await systemAuthMiddleware(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('returns 500 on missing config', async () => {
    const previousUser = process.env.SYSTEM_USER;
    const previousPass = process.env.SYSTEM_PASS;
    delete process.env.SYSTEM_USER;
    delete process.env.SYSTEM_PASS;
    const { configLoader } = await configPromise;
    const getConfigSpy = spyOn(configLoader, 'getConfig').mockReturnValue({
      app: { name: 'x', version: '1' },
      database: { pool: { min: 1, max: 1, idleTimeoutMs: 1 } },
      auth: { jwt: { secret: 's', expiresIn: '1d' } },
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
        keyPrefix: 'test:',
        streams: { maxLen: 1000, blockMs: 100 },
      },
      logging: { level: 'info', pretty: false },
      metrics: { enabled: false },
    } as Config);

    const creds = Buffer.from('user:pass').toString('base64');
    const c = createContext(`Basic ${creds}`);
    const next = mock(async () => undefined);
    const { systemAuthMiddleware } = await middlewarePromise;
    await systemAuthMiddleware(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(500);
    getConfigSpy.mockRestore();
    if (previousUser !== undefined) {
      process.env.SYSTEM_USER = previousUser;
    }
    if (previousPass !== undefined) {
      process.env.SYSTEM_PASS = previousPass;
    }
  });

  it('rejects invalid credentials', async () => {
    const { configLoader } = await configPromise;
    const config = configLoader.getConfig();
    const creds = Buffer.from('wrong:creds').toString('base64');
    const c = createContext(`Basic ${creds}`);
    const next = mock(async () => undefined);
    if (!config.security?.systemAuth?.username || !config.security.systemAuth?.password) {
      config.security = {
        encryptionEnabled: false,
        keyRotationInterval: 0,
        auditLogging: false,
        systemAuth: { username: 'user', password: 'pass' },
      };
    }
    const { systemAuthMiddleware } = await middlewarePromise;
    await systemAuthMiddleware(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('accepts valid credentials', async () => {
    const { configLoader } = await configPromise;
    const config = configLoader.getConfig();
    if (!config.security?.systemAuth?.username || !config.security.systemAuth?.password) {
      config.security = {
        encryptionEnabled: false,
        keyRotationInterval: 0,
        auditLogging: false,
        systemAuth: { username: 'user', password: 'pass' },
      };
    }
    const security = config.security;
    const creds = Buffer.from(
      `${security.systemAuth?.username}:${security.systemAuth?.password}`
    ).toString('base64');
    const c = createContext(`Basic ${creds}`);
    const next = mock(async () => undefined);
    const { systemAuthMiddleware } = await middlewarePromise;
    await systemAuthMiddleware(c, next);
    expect(next).toHaveBeenCalled();
  });
});
