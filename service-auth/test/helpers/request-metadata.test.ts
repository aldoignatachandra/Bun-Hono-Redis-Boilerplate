import { describe, expect, it } from 'bun:test';
import type { Context } from 'hono';
import { getRequestMetadata } from '../../src/helpers/request-metadata';

const createContext = (headers: Record<string, string>): Context =>
  ({
    req: {
      header: (key: string) => headers[key],
    },
  }) as unknown as Context;

describe('request metadata', () => {
  it('reads ip from x-forwarded-for', () => {
    const c = createContext({
      'x-forwarded-for': '192.168.1.1, 10.0.0.1',
      'user-agent': 'Mozilla/5.0',
    });
    const metadata = getRequestMetadata(c);
    expect(metadata.ipAddress).toBe('192.168.1.1');
  });

  it('uses localhost in dev when ip is missing', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'dev';
    const c = createContext({
      'user-agent': 'Mozilla/5.0',
    });
    const metadata = getRequestMetadata(c);
    expect(metadata.ipAddress).toBe('127.0.0.1');
    process.env.NODE_ENV = previous;
  });

  it('extracts user agent and device type', () => {
    const c = createContext({
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    });
    const metadata = getRequestMetadata(c);
    expect(metadata.userAgent).toContain('iPhone');
    expect(metadata.deviceType).toBeDefined();
  });
});
