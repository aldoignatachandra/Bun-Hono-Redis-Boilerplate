import { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { drizzleDb } from '../db/connection';
import { comparePassword } from '../helpers/password';

// Extend Hono Context to include the authenticated user
declare module 'hono' {
  interface ContextVariableMap {
    userCredentials: {
      id: string;
      email: string;
      username: string;
      name: string | null;
      role: 'ADMIN' | 'USER';
    };
  }
}

/**
 * User Login Basic Auth Middleware
 *
 * Used specifically for the `/login` endpoint.
 * Extracts credentials from Authorization header, validates against DB (users table),
 * and attaches the user object to the context.
 */
export const basicAuthMiddleware = createMiddleware(async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return c.json(
      { message: 'Unauthorized: Missing or invalid Authorization header (Basic Auth required)' },
      401
    );
  }

  // Decode Credentials
  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const [identifier, password] = credentials.split(':');

  if (!identifier || !password) {
    return c.json({ message: 'Unauthorized: Invalid credentials format' }, 401);
  }

  try {
    // Verify Credentials against Database (Email OR Username)
    const user = await drizzleDb.query.users.findFirst({
      where: (users, { or, eq }) => or(eq(users.email, identifier), eq(users.username, identifier)),
    });

    if (!user || !user.password) {
      // Return generic error to prevent enumeration
      return c.json({ message: 'Unauthorized: Invalid credentials' }, 401);
    }

    const validPassword = await comparePassword(password, user.password);
    if (!validPassword) {
      return c.json({ message: 'Unauthorized: Invalid credentials' }, 401);
    }

    // Attach user to context for the handler to use
    c.set('userCredentials', {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role || 'USER',
    });

    await next();
  } catch (error) {
    console.error('Basic Auth Error:', error);
    return c.json({ message: 'Internal Server Error during authentication' }, 500);
  }
});
