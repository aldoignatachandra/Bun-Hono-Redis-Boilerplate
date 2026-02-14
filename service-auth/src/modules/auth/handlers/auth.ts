import { eq } from 'drizzle-orm';
import { Context } from 'hono';
import jwt from 'jsonwebtoken';
import { configLoader } from '../../../config/loader';
import { drizzleDb } from '../../../db/connection';
import { userSessions } from '../../../db/schema';
import { getRequestMetadata } from '../../../helpers/request-metadata';
import { authLoginProducer, authLogoutProducer } from '../events/auth-events';

// Define JWT Payload type
interface JWTPayload {
  sub: string;
  jti: string; // Session ID
  email: string;
  role: string;
}

/**
 * Single Session Login Handler
 *
 * Pre-requisite: Protected by `basicAuthMiddleware`.
 * Logic:
 * 1. Retrieves authenticated user from context.
 * 2. Force deletes ALL existing sessions for this user (Single Session Policy).
 * 3. Creates a new session with metadata (IP, UA, Device).
 * 4. Issues a signed JWT linked to the new Session ID.
 */
export const loginHandler = async (c: Context) => {
  // 1. Retrieve Authenticated User (set by basicAuthMiddleware)
  const user = c.get('userCredentials');

  if (!user) {
    // Should be caught by middleware, but safe guard
    return c.json({ message: 'Unauthorized: No credentials provided' }, 401);
  }

  // 2. Get Request Metadata
  const { ipAddress, userAgent, deviceType } = getRequestMetadata(c);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1); // 1 Day Expiry

  try {
    // 3. Atomic Session Management (Force Delete Old -> Create New)
    const session = await drizzleDb.transaction(async tx => {
      // A. FORCE DELETE all existing sessions for this user (Hard Delete)
      // This enforces the "Single Active Session" rule
      await tx.delete(userSessions).where(eq(userSessions.userId, user.id));

      // B. Create New Session
      const [newSession] = await tx
        .insert(userSessions)
        .values({
          userId: user.id,
          ipAddress,
          userAgent,
          deviceType,
          expiresAt: expiresAt,
        })
        .returning();

      return newSession;
    });

    // 4. Generate JWT tied to Session ID (jti)
    const payload: JWTPayload = {
      sub: user.id,
      jti: session.id,
      email: user.email,
      role: user.role,
    };

    const secret = configLoader.getConfig().auth.jwt.secret;
    const token = jwt.sign(payload, secret, { expiresIn: '1d' });

    // 5. Publish Login Event
    await authLoginProducer({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
      ipAddress,
      userAgent,
      deviceType,
    });

    return c.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login Handler Error:', error);
    return c.json({ message: 'Failed to process login' }, 500);
  }
};

/**
 * Logout Handler
 * Force Deletes the current session
 */
export const logoutHandler = async (c: Context) => {
  // 'user' here is set by the JWT 'auth' middleware, not basic auth
  const user = c.get('user') as JWTPayload;

  if (!user || !user.jti) {
    return c.json({ message: 'Invalid session' }, 401);
  }

  try {
    // Force Delete specific session
    await drizzleDb.delete(userSessions).where(eq(userSessions.id, user.jti));

    // Publish Logout Event
    await authLogoutProducer({
      userId: user.sub,
      email: user.email,
      role: user.role,
      sessionId: user.jti,
    });

    return c.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout Handler Error:', error);
    return c.json({ message: 'Failed to logout' }, 500);
  }
};
