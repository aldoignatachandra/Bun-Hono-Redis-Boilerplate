import { Context, Next } from 'hono';

export const REQUEST_ID_HEADER = 'X-Request-ID';

export function requestIdMiddleware() {
  return async (c: Context, next: Next) => {
    const incomingId = c.req.header(REQUEST_ID_HEADER);
    const requestId = incomingId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    c.set('requestId', requestId);
    c.header(REQUEST_ID_HEADER, requestId);

    await next();
  };
}
