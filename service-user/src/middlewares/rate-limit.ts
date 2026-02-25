import { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { errorResponse } from '../helpers/api-response';
import { getRequestMetadata } from '../helpers/request-metadata';
import { checkAndConsume } from '../helpers/rate-limiter';

export const rateLimiter = (maxRequests: number, windowSeconds: number) =>
  createMiddleware(async (c: Context, next) => {
    const user = c.get('user') as { sub?: string } | undefined;
    const identity = user?.sub || getRequestMetadata(c).ipAddress || 'unknown';
    const method = c.req.method;
    const path = c.req.path;
    const key = `${method}:${path}:${identity}`;
    const result = checkAndConsume(key, maxRequests, windowSeconds * 1000);

    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      c.header('Retry-After', String(result.retryAfter));
      return errorResponse(c, 'Too many requests', 'RATE_LIMITED', 429);
    }

    await next();
  });
