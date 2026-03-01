import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { Context } from 'hono';
let callCount = 0;
const evalMock = mock(async () => {
  callCount += 1;
  return callCount === 1 ? [1, 0, 1] : [0, 5, 2];
});

mock.module('../../src/helpers/redis', () => ({
  getRedisClient: () => ({
    eval: evalMock,
    status: 'ready',
    xadd: mock(async () => '1-0'),
    xgroup: mock(async () => 'OK'),
    xreadgroup: mock(async () => null),
    xack: mock(async () => 1),
    quit: mock(async () => 'OK'),
  }),
}));

const modulePromise = import('../../src/middlewares/rate-limit');

type JsonFn = (data: unknown, status?: number) => unknown;

const createContext = (
  path: string,
  method: string,
  values: Record<string, unknown> = {}
): Context => {
  const json = mock((data: unknown, status?: number) => ({ data, status })) as unknown as JsonFn;
  const set = mock((_key: string, _value: unknown) => undefined);
  const get = mock((key: string) => values[key]);
  const header = mock((_key: string, _value?: string) => undefined);
  return {
    req: { path, method, header: (_key: string) => (values['ip'] as string) || '127.0.0.1' },
    json,
    set,
    get,
    header,
  } as unknown as Context;
};

describe('rate limiter middleware', () => {
  beforeEach(() => {
    callCount = 0;
  });

  it('uses IP when user is not provided', async () => {
    const { rateLimiter } = await modulePromise;
    const c = createContext('/products', 'POST', {});
    const next = mock(async () => undefined);
    const mw = rateLimiter(1, 1);
    await mw(c, next);
    expect(next).toHaveBeenCalled();
    await mw(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(429);
  });

  it('uses user id when available', async () => {
    const { rateLimiter } = await modulePromise;
    const c = createContext('/products', 'POST', { user: { sub: 'u1' } });
    const next = mock(async () => undefined);
    const mw = rateLimiter(1, 1);
    await mw(c, next);
    expect(next).toHaveBeenCalled();
    await mw(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(429);
  });
});
