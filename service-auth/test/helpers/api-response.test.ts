import { describe, expect, it, mock } from 'bun:test';
import type { Context } from 'hono';
import { z, ZodError } from 'zod';
import { errorResponse, successResponse } from '../../src/helpers/api-response';

const createContext = (): Context => {
  const json = mock((data: unknown, status?: number) => ({ data, status }));
  return {
    json,
  } as unknown as Context;
};

describe('api-response', () => {
  it('formats success responses', () => {
    const c = createContext();
    const data = { id: '1' };
    successResponse(c, data, 'ok', 201);
    const args = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(args[0]).toEqual({
      success: true,
      message: 'ok',
      data,
      meta: undefined,
    });
    expect(args[1]).toBe(201);
  });

  it('formats error responses with string details', () => {
    const c = createContext();
    errorResponse(c, 'bad', 'ERR', 400, 'invalid');
    const args = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(args[0]).toEqual({
      success: false,
      message: 'bad',
      error: {
        code: 'ERR',
        details: [{ code: 'error', message: 'invalid' }],
      },
    });
    expect(args[1]).toBe(400);
  });

  it('formats zod errors', () => {
    const c = createContext();
    const zodError = (() => {
      try {
        z.string().parse(123);
      } catch (error) {
        return error as ZodError;
      }
      return undefined;
    })();
    if (!zodError) {
      throw new Error('ZodError expected');
    }
    errorResponse(c, 'validation', 'VALIDATION_ERROR', 400, zodError);
    const args = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const payload = args[0] as { error: { details: Array<{ path: string[] }> } };
    expect(payload.error.details.length).toBeGreaterThan(0);
    expect(payload.error.details[0].path).toEqual([]);
  });

  it('formats postgres unique violations', () => {
    const c = createContext();
    const pgError = {
      code: '23505',
      severity: 'ERROR',
      detail: 'Key (email)=(test@example.com) already exists.',
    };
    errorResponse(c, 'db', 'DB_ERROR', 500, pgError);
    const args = (c.json as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    const payload = args[0] as { error: { details: Array<{ code: string; path: string[] }> } };
    expect(payload.error.details[0].code).toBe('unique_violation');
    expect(payload.error.details[0].path).toEqual(['email']);
  });
});
