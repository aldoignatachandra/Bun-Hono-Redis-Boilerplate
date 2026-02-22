import { eq } from 'drizzle-orm';
import { Context } from 'hono';
import jwt from 'jsonwebtoken';
import { configLoader } from '../../../config/loader';
import { drizzleDb } from '../../../db/connection';
import { userSessions } from '../../../db/schema';
import { errorResponse, successResponse } from '../../../helpers/api-response';
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
    return errorResponse(c, 'Unauthorized: No credentials provided', 'UNAUTHORIZED', 401);
  }

  // 2. Get Request Metadata
  const { ipAddress, userAgent, deviceType } = getRequestMetadata(c);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1); // 1 Day Expiry

  // 3. Generate Session ID & Token
  const sessionId = crypto.randomUUID();
  const secret = configLoader.getConfig().auth.jwt.secret;

  const payload: JWTPayload = {
    sub: user.id,
    jti: sessionId,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, secret, { expiresIn: '1d' });

  try {
    // 4. Atomic Session Management (Force Delete Old -> Create New)
    await drizzleDb.transaction(async tx => {
      // A. FORCE DELETE all existing sessions for this user (Hard Delete)
      await tx.delete(userSessions).where(eq(userSessions.userId, user.id));

      // B. Create New Session with Token
      await tx.insert(userSessions).values({
        id: sessionId,
        userId: user.id,
        token,
        ipAddress,
        userAgent,
        deviceType,
        expiresAt: expiresAt,
      });
    });

    // [Kafka] Send 'auth.login' event to message broker for activity logging
    await authLoginProducer({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: sessionId,
      ipAddress,
      userAgent,
      deviceType,
    });

    return successResponse(
      c,
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      },
      'Login successful'
    );
  } catch (error) {
    console.error('Login Handler Error:', error);
    return errorResponse(c, 'Failed to process login', 'LOGIN_FAILED', 500, error);
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
    return errorResponse(c, 'Invalid session', 'INVALID_SESSION', 401);
  }

  try {
    // 1. Get Request Metadata (Same as Login)
    const { ipAddress, userAgent, deviceType } = getRequestMetadata(c);

    // 2. Force Delete specific session
    await drizzleDb.delete(userSessions).where(eq(userSessions.id, user.jti));

    // [Kafka] Send 'auth.logout' event to message broker for activity logging
    await authLogoutProducer({
      userId: user.sub,
      email: user.email,
      role: user.role,
      sessionId: user.jti,
      ipAddress,
      userAgent,
      deviceType,
    });

    return successResponse(c, null, 'Logged out successfully');
  } catch (error) {
    console.error('Logout Handler Error:', error);
    return errorResponse(c, 'Failed to logout', 'LOGOUT_FAILED', 500, error);
  }
};
