import crypto from 'crypto';
import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { configLoader } from '../config/loader';

/**
 * System Basic Auth Middleware
 *
 * Best Practice Implementation for "Service-to-Service" or "Internal Tool" protection.
 * Uses hardcoded credentials from Environment Variables.
 *
 * Security Features:
 * 1. Constant-Time Comparison (timingSafeEqual) to prevent timing attacks.
 * 2. Checks against Environment Variables (12-Factor App).
 * 3. Enforces HTTPS (in production) - implicit via infrastructure usually, but good to know.
 *
 * Usage:
 * Apply this to routes that need to be accessed by other internal services or admins
 * (e.g., /metrics, /health/detailed, /admin/*).
 */
export const systemAuthMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return c.json({ message: 'Unauthorized: Missing or invalid Authorization header' }, 401);
  }

  // Decode Credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [username, password] = credentials.split(':');

  if (!username || !password) {
    return c.json({ message: 'Unauthorized: Invalid credentials format' }, 401);
  }

  // Retrieve expected credentials from Config/Env
  const config = configLoader.getConfig();

  // Get credentials from config (which loads from env via loader)
  const expectedUser = config.security?.systemAuth?.username || process.env.SYSTEM_USER;
  const expectedPass = config.security?.systemAuth?.password || process.env.SYSTEM_PASS;

  if (!expectedUser || !expectedPass) {
    console.error('System Auth Error: SYSTEM_USER or SYSTEM_PASS not configured');
    return c.json({ message: 'Internal Server Error: Auth misconfiguration' }, 500);
  }

  // Secure Constant-Time Comparison
  // This prevents attackers from guessing the password byte-by-byte based on response time.
  const userMatch = safeCompare(username, expectedUser);
  const passMatch = safeCompare(password, expectedPass);

  if (!userMatch || !passMatch) {
    return c.json({ message: 'Unauthorized: Invalid credentials' }, 401);
  }

  await next();
});

/**
 * Safely compares two strings using timingSafeEqual to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);

    // Buffers must be same length for timingSafeEqual
    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}
