import { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { errorResponse } from '../helpers/api-response';
import { getRedisClient } from '../helpers/redis';
import { RedisRateLimiter } from '../helpers/redis-rate-limiter';
import { getRequestMetadata } from '../helpers/request-metadata';

export const rateLimiter = (maxRequests: number, windowSeconds: number) =>
  createMiddleware(async (c: Context, next) => {
    const user = c.get('user') as { sub?: string } | undefined;
    const identity = user?.sub || getRequestMetadata(c).ipAddress || 'unknown';
    const method = c.req.method;
    const path = c.req.path;
    const key = `${method}:${path}:${identity}`;
    let result: Awaited<ReturnType<RedisRateLimiter['check']>> | null = null;
    try {
      const redis = getRedisClient();

      // If Redis is not ready (connecting/reconnecting), we fail open to avoid latency.
      if (redis.status !== 'ready') {
        console.warn(`[RateLimit] Redis not ready (status: ${redis.status}). Failing open.`);
        await next();
        return;
      }

      const limiter = new RedisRateLimiter(redis);
      const start = Date.now();
      result = await limiter.check(key, maxRequests, windowSeconds);
      const duration = Date.now() - start;

      if (duration > 100) {
        console.warn(`[RateLimit] Slow check for ${key}: ${duration}ms`);
      }
    } catch (error) {
      console.error('[RateLimit] Error checking rate limit:', error);
      await next();
      return;
    }

    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    c.header('X-RateLimit-Reset', String(result.retryAfter));

    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter));
      return errorResponse(c, 'Too many requests', 'RATE_LIMITED', 429);
    }

    await next();
  });
