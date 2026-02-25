import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { Context } from 'hono';
import { resetRateLimiterStore } from '../../src/helpers/rate-limiter';
import { rateLimiter } from '../../src/middlewares/rate-limit';

process.env.NODE_ENV = 'dev';

type JsonFn = (data: unknown, status?: number) => unknown;

const createContext = (
  path: string,
  method: string,
  values: Record<string, unknown> = {}
): Context => {
  const json = mock((data: unknown, status?: number) => ({ data, status })) as unknown as JsonFn;
  const set = mock((_key: string, _value: unknown) => undefined);
  const get = mock((key: string) => values[key]);
  const header = mock((key: string, value?: string) => {
    return value ? undefined : undefined;
  });
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
    resetRateLimiterStore();
  });

  it('uses IP when user is not provided', async () => {
    const c = createContext('/auth/login', 'POST', {});
    const next = mock(async () => undefined);
    const mw = rateLimiter(1, 1);
    await mw(c, next);
    expect(next).toHaveBeenCalled();
    await mw(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(429);
  });

  it('uses user id when available', async () => {
    const c = createContext('/auth/logout', 'POST', { user: { sub: 'u1' } });
    const next = mock(async () => undefined);
    const mw = rateLimiter(1, 1);
    await mw(c, next);
    expect(next).toHaveBeenCalled();
    await mw(c, next);
    const jsonCalls = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(jsonCalls[0][1]).toBe(429);
  });
});
