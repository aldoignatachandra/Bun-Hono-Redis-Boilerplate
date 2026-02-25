import { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { errorResponse } from '../helpers/api-response';
import { checkAndConsume } from '../helpers/rate-limiter';
import { getRequestMetadata } from '../helpers/request-metadata';

// Rate limiter middleware factory for per-route usage.
export const rateLimiter = (maxRequests: number, windowSeconds: number) =>
  createMiddleware(async (c: Context, next) => {
    // Prefer authenticated identity, fallback to IP for anonymous clients.
    const user = c.get('user') as { sub?: string } | undefined;
    const userCredentials = c.get('userCredentials') as { id?: string } | undefined;
    const identity =
      user?.sub || userCredentials?.id || getRequestMetadata(c).ipAddress || 'unknown';
    const method = c.req.method;
    const path = c.req.path;
    const key = `${method}:${path}:${identity}`;
    const result = checkAndConsume(key, maxRequests, windowSeconds * 1000);

    // Standard rate limit headers for client visibility.
    c.header('X-RateLimit-Limit', String(result.limit));
    c.header('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      // Fast fail with Retry-After and consistent error payload.
      c.header('Retry-After', String(result.retryAfter));
      return errorResponse(c, 'Too many requests', 'RATE_LIMITED', 429);
    }

    await next();
  });
