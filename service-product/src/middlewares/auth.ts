import { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';
import { configLoader } from '../config/loader';
import { JWTPayload } from '../helpers/types';

// Authentication middleware
export const auth = createMiddleware(async (c: Context, next) => {
  const authHeader = c.req.header('authorization');

  if (!authHeader) {
    return c.text('Unauthorized: Missing authorization header', 401);
  }

  const token = authHeader.replace(/^Bearer\s+/i, '');

  try {
    const payload = jwt.verify(token, configLoader.getConfig().auth.jwt.secret) as JWTPayload;
    c.set('user', payload);
    await next();
  } catch (error) {
    return c.text('Unauthorized: Invalid token', 401);
  }
});

// Role-based authorization middleware
export const requireRole = (role: 'ADMIN' | 'USER') =>
  createMiddleware(async (c: Context, next) => {
    const user = c.get('user') as JWTPayload;

    if (!user || user.role !== role) {
      return c.text('Forbidden: Insufficient permissions', 403);
    }

    await next();
  });

// JWT token generation
export const generateToken = (user: { id: string; email: string; role: string }) => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const secret = configLoader.getConfig().auth.jwt.secret;
  const options: any = { expiresIn: configLoader.getConfig().auth.jwt.expiresIn };

  return jwt.sign(payload, secret, options);
};

// User authentication utilities for Drizzle
export const authenticateUser = async (
  _email: string,
  _password: string
): Promise<{ id: string; email: string; role: string } | null> => {
  // This is a placeholder implementation
  // In a real application, you would use the Drizzle user repository
  // to authenticate the user against the database
  try {
    // Example implementation (would need to import the user repository):
    // const user = await userRepository.findByEmail(email);
    // if (!user) return null;
    //
    // const isPasswordValid = await bcrypt.compare(password, user.password);
    // if (!isPasswordValid) return null;
    //
    // return { id: user.id, email: user.email, role: user.role };

    // For now, return null to indicate this needs implementation
    return null;
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
};

// Password hashing utilities
export const hashPassword = async (_password: string): Promise<string> => {
  // This is a placeholder - would need to import bcrypt
  // return await bcrypt.hash(password, 10);
  return 'hashed_password_placeholder';
};

export const verifyPassword = async (
  _password: string,
  _hashedPassword: string
): Promise<boolean> => {
  // This is a placeholder - would need to import bcrypt
  // return await bcrypt.compare(password, hashedPassword);
  return false;
};
