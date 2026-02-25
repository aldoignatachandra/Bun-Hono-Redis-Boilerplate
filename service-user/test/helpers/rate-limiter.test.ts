import { describe, expect, it } from 'bun:test';
import { checkAndConsume, resetRateLimiterStore } from '../../src/helpers/rate-limiter';

describe('rate limiter helper', () => {
  it('allows within limit and blocks after', () => {
    resetRateLimiterStore();
    const key = 'POST:/admin/users:ip:1.2.3.4';
    const first = checkAndConsume(key, 2, 1000, 1000);
    const second = checkAndConsume(key, 2, 1000, 1001);
    const third = checkAndConsume(key, 2, 1000, 1002);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
  });

  it('refills after window passes', () => {
    resetRateLimiterStore();
    const key = 'POST:/admin/users:ip:1.2.3.4';
    checkAndConsume(key, 1, 1000, 1000);
    const blocked = checkAndConsume(key, 1, 1000, 1001);
    const allowed = checkAndConsume(key, 1, 1000, 2001);
    expect(blocked.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });
});
