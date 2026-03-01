import { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { errorResponse } from '../helpers/api-response';
import { getRedisClient } from '../helpers/redis';
import { RedisRateLimiter } from '../helpers/redis-rate-limiter';
import { getRequestMetadata } from '../helpers/request-metadata';

// Rate limiter middleware factory for per-route usage.
export const rateLimiter = (maxRequests: number, windowSeconds: number) =>
  createMiddleware(async (c: Context, next) => {
    const user = c.get('user') as { sub?: string } | undefined;
    const userCredentials = c.get('userCredentials') as { id?: string } | undefined;
    const identity =
      user?.sub || userCredentials?.id || getRequestMetadata(c).ipAddress || 'unknown';
    const method = c.req.method;
    const path = c.req.path;
    const key = `${method}:${path}:${identity}`;
    let result: Awaited<ReturnType<RedisRateLimiter['check']>> | null = null;
    try {
      const redis = getRedisClient();
      const limiter = new RedisRateLimiter(redis);
      result = await limiter.check(key, maxRequests, windowSeconds);
    } catch (_error) {
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
