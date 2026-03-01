import { describe, expect, it, mock } from 'bun:test';
import type { Redis } from 'ioredis';
import { RedisRateLimiter } from '../../src/helpers/redis-rate-limiter';

describe('redis rate limiter helper', () => {
  it('allows within limit', async () => {
    const redis = {
      eval: mock(async () => [1, 0, 1]),
    };
    const limiter = new RedisRateLimiter(redis as unknown as Redis);
    const result = await limiter.check('key', 2, 60);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('blocks when over limit', async () => {
    const redis = {
      eval: mock(async () => [0, 10, 3]),
    };
    const limiter = new RedisRateLimiter(redis as unknown as Redis);
    const result = await limiter.check('key', 2, 60);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBe(10);
    expect(result.remaining).toBe(0);
  });
});
