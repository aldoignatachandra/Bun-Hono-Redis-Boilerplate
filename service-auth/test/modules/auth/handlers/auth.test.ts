import { describe, expect, it, mock, spyOn } from 'bun:test';
import type { Context } from 'hono';

process.env.NODE_ENV = 'dev';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.KAFKA_BROKERS = process.env.KAFKA_BROKERS ?? 'localhost:9092';
process.env.KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID ?? 'test-client';
process.env.PORT = process.env.PORT ?? '3100';
process.env.SYSTEM_USER = process.env.SYSTEM_USER ?? 'system';
process.env.SYSTEM_PASS = process.env.SYSTEM_PASS ?? 'system';

const handlersPromise = import('../../../../src/modules/auth/handlers/auth');
const eventsPromise = import('../../../../src/modules/auth/events/auth-events');
const connectionPromise = import('../../../../src/db/connection');

type JsonFn = (data: unknown, status?: number) => unknown;

const createContext = (values: Record<string, unknown>): Context => {
  const json = mock((data: unknown, status?: number) => ({ data, status })) as unknown as JsonFn;
  const get = mock((key: string) => values[key]);
  const req = {
    header: (_key: string) => 'Mozilla/5.0',
  };
  return {
    get,
    json,
    req,
  } as unknown as Context;
};

describe('auth handlers', () => {
  it('logs in successfully', async () => {
    const user = {
      id: 'u1',
      email: 'a@b.com',
      username: 'user',
      name: 'User',
      role: 'USER',
    };

    const txDeleteWhere = mock(async () => undefined);
    const txInsertValues = mock(async () => undefined);
    const tx = {
      delete: mock(() => ({ where: txDeleteWhere })),
      insert: mock(() => ({ values: txInsertValues })),
    };

    const { drizzleDb } = await connectionPromise;
    const dbRef = drizzleDb as unknown as {
      transaction: (cb: (t: typeof tx) => Promise<void>) => Promise<void>;
    };
    dbRef.transaction = mock(cb => cb(tx));

    const authEvents = await eventsPromise;
    const loginSpy = spyOn(authEvents, 'authLoginProducer').mockResolvedValue(undefined);

    const randomUuidSpy = spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-0000-0000-000000000000'
    );

    const c = createContext({ userCredentials: user });
    const { loginHandler } = await handlersPromise;
    await loginHandler(c);

    expect(txDeleteWhere).toHaveBeenCalled();
    expect(txInsertValues).toHaveBeenCalled();
    expect(loginSpy).toHaveBeenCalled();

    randomUuidSpy.mockRestore();
    loginSpy.mockRestore();
  });

  it('returns 401 if missing credentials', async () => {
    const c = createContext({});
    const { loginHandler } = await handlersPromise;
    await loginHandler(c);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });

  it('logs out successfully', async () => {
    const user = {
      sub: 'u1',
      jti: 'session-1',
      email: 'a@b.com',
      role: 'USER',
    };

    const deleteWhere = mock(async () => undefined);
    const { drizzleDb } = await connectionPromise;
    const dbRef = drizzleDb as unknown as {
      delete: (_table: unknown) => { where: (cond: unknown) => Promise<void> };
    };
    dbRef.delete = mock(() => ({ where: deleteWhere }));

    const authEvents = await eventsPromise;
    const logoutSpy = spyOn(authEvents, 'authLogoutProducer').mockResolvedValue(undefined);

    const c = createContext({ user });
    const { logoutHandler } = await handlersPromise;
    await logoutHandler(c);

    expect(deleteWhere).toHaveBeenCalled();
    expect(logoutSpy).toHaveBeenCalled();
    logoutSpy.mockRestore();
  });

  it('returns 401 on logout without session', async () => {
    const c = createContext({ user: { sub: 'u1' } });
    const { logoutHandler } = await handlersPromise;
    await logoutHandler(c);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(401);
  });
});
