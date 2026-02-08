import { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';
import { configLoader } from '../config/loader';
import { JWTPayload } from '../helpers/types';

// Extended JWTPayload to include jti
interface ExtendedJWTPayload extends JWTPayload {
  jti: string;
}

// Authentication middleware
export const auth = createMiddleware(async (c: Context, next) => {
  const authHeader = c.req.header('authorization');

  if (!authHeader) {
    return c.json({ message: 'Unauthorized: Missing authorization header' }, 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');

  try {
    // 1. Stateless Verification (Signature)
    const secret = configLoader.getConfig().auth.jwt.secret;
    const payload = jwt.verify(token, secret) as ExtendedJWTPayload;

    if (!payload.jti) {
       return c.json({ message: 'Unauthorized: Invalid token structure' }, 401);
    }

    // Note: service-product does not have direct access to user_sessions table (separate DB/Service).
    // Ideally, we would make an HTTP call to service-auth/verify or check a shared Redis.
    // For this boilerplate, we trust the signature for now, OR we could duplicate the session table check if using shared DB.
    // Given the prompt "best boilerplate", we should implement the check if possible, but without shared DB access code here, 
    // we'll rely on the strong signature and short expiration.
    // TODO: Implement Inter-Service Session Check via gRPC or HTTP

    c.set('user', payload);
    await next();
  } catch (error) {
    return c.json({ message: 'Unauthorized: Invalid token' }, 401);
  }
});

// Role-based authorization middleware
export const requireRole = (role: 'ADMIN' | 'USER') =>
  createMiddleware(async (c: Context, next) => {
    const user = c.get('user') as JWTPayload;

    if (!user || user.role !== role) {
      return c.json({ message: 'Forbidden: Insufficient permissions' }, 403);
    }

    await next();
  });
