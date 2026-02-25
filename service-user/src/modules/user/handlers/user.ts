import { Hono } from 'hono';
import { Container } from 'typedi';
import { errorResponse, successResponse } from '../../../helpers/api-response';
import { getRequestMetadata } from '../../../helpers/request-metadata';
import { JWTPayload } from '../../../helpers/types';
import { auth, requireRole } from '../../../middlewares/auth';
import { rateLimiter } from '../../../middlewares/rate-limit';
import { CreateUserSchema } from '../domain/auth';
import { CreateUserCommand } from '../repositories/commands/CreateUserCommand';
import { DeleteUserCommand } from '../repositories/commands/DeleteUserCommand';
import { RestoreUserCommand } from '../repositories/commands/RestoreUserCommand';
import { GetUserQuery } from '../repositories/queries/GetUserQuery';
import { UserRepository } from '../repositories/UserRepository';

// Define types for Hono context
type User = {
  sub: string;
  email: string;
  role: string;
};

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

const userRoutes = new Hono();

// User routes rate limits
const rateLimits = {
  create: { maxRequests: 10, windowSeconds: 60 },
  list: { maxRequests: 120, windowSeconds: 60 },
  remove: { maxRequests: 5, windowSeconds: 60 },
  profile: { maxRequests: 120, windowSeconds: 60 },
};

// Protected admin routes
userRoutes.use('/admin/*', auth, requireRole('ADMIN'));

// Create user (admin only)
userRoutes.post(
  '/admin/users',
  rateLimiter(rateLimits.create.maxRequests, rateLimits.create.windowSeconds),
  async c => {
    try {
      const body = await c.req.json();
      const validatedData = CreateUserSchema.parse(body);
      const metadata = getRequestMetadata(c);

      const createUserCommand = Container.get(CreateUserCommand);
      const user = await createUserCommand.execute(validatedData, metadata);

      return successResponse(
        c,
        {
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        },
        'User created successfully',
        201
      );
    } catch (error) {
      console.log(error);
      return errorResponse(c, 'Failed to create user', 'USER_CREATE_FAILED', 400, error);
    }
  }
);

// Get users (admin only)
userRoutes.get(
  '/admin/users',
  auth,
  requireRole('ADMIN'),
  rateLimiter(rateLimits.list.maxRequests, rateLimits.list.windowSeconds),
  async c => {
    try {
      const page = parseInt(c.req.query('page') || '1');
      const limit = parseInt(c.req.query('limit') || '10');
      const includeDeleted = c.req.query('includeDeleted') === 'true';
      const search = c.req.query('search');

      const offset = (page - 1) * limit;

      const userRepository = Container.get(UserRepository);
      const { data: users, total } = await userRepository.findAll({
        includeDeleted,
        limit,
        offset,
        search,
      });

      const totalPages = Math.ceil(total / limit);
      const hasNextPage = page < totalPages;
      const hasPreviousPage = page > 1;

      return successResponse(c, users, 'Users fetched successfully', 200, {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        search,
      });
    } catch (error) {
      return errorResponse(c, 'Failed to fetch users', 'USER_FETCH_FAILED', 500, error);
    }
  }
);

// Get user by ID (admin only)
userRoutes.get('/admin/users/:id', auth, requireRole('ADMIN'), async c => {
  try {
    const userId = c.req.param('id');
    const includeDeleted = c.req.query('includeDeleted') === 'true';

    const getUserQuery = Container.get(GetUserQuery);

    const user = includeDeleted
      ? await getUserQuery.executeWithDeleted(userId)
      : await getUserQuery.execute(userId);

    if (!user) {
      return errorResponse(c, 'User not found', 'USER_NOT_FOUND', 404);
    }

    return successResponse(c, user, 'User fetched successfully');
  } catch (error) {
    return errorResponse(c, 'Failed to fetch user', 'USER_FETCH_FAILED', 500, error);
  }
});

// Soft delete user (admin only)
userRoutes.delete(
  '/admin/users/:id',
  auth,
  requireRole('ADMIN'),
  rateLimiter(rateLimits.remove.maxRequests, rateLimits.remove.windowSeconds),
  async c => {
    try {
      const userId = c.req.param('id');
      const force = c.req.query('force') === 'true';
      const currentUser = c.get('user') as JWTPayload;

      const deleteUserCommand = Container.get(DeleteUserCommand);
      await deleteUserCommand.execute(userId, currentUser, force);

      return successResponse(
        c,
        {
          userId,
          force,
        },
        force ? 'User permanently deleted' : 'User soft deleted'
      );
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'User not found') {
          return errorResponse(c, 'User not found', 'USER_NOT_FOUND', 404);
        }
        if (error.message === 'User already deleted') {
          return errorResponse(c, 'User already deleted', 'USER_ALREADY_DELETED', 400);
        }
        if (error.message === 'Cannot delete yourself') {
          return errorResponse(c, 'Cannot delete yourself', 'USER_DELETE_FORBIDDEN', 403);
        }
        if (error.message === 'Cannot delete other admins') {
          return errorResponse(c, 'Cannot delete other admins', 'USER_DELETE_FORBIDDEN', 403);
        }
      }
      return errorResponse(c, 'Failed to delete user', 'USER_DELETE_FAILED', 500, error);
    }
  }
);

// Restore soft-deleted user (admin only)
userRoutes.post('/admin/users/:id/restore', auth, requireRole('ADMIN'), async c => {
  try {
    const userId = c.req.param('id');

    const restoreUserCommand = Container.get(RestoreUserCommand);
    const restoredUser = await restoreUserCommand.execute(userId);

    return successResponse(c, { user: restoredUser }, 'User restored successfully');
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return errorResponse(c, 'User not found', 'USER_NOT_FOUND', 404);
      }
      if (error.message === 'User is already active') {
        return errorResponse(c, 'User is already active', 'USER_ALREADY_ACTIVE', 400);
      }
    }
    return errorResponse(c, 'Failed to restore user', 'USER_RESTORE_FAILED', 500, error);
  }
});

// Get current user info
userRoutes.get(
  '/me',
  auth,
  rateLimiter(rateLimits.profile.maxRequests, rateLimits.profile.windowSeconds),
  async c => {
    const user = c.get('user') as JWTPayload;

    const getUserQuery = Container.get(GetUserQuery);
    const userDetails = await getUserQuery.execute(user.sub);

    if (!userDetails) {
      return errorResponse(c, 'User not found', 'USER_NOT_FOUND', 404);
    }

    return successResponse(
      c,
      {
        id: userDetails.id,
        email: userDetails.email,
        username: userDetails.username,
        name: userDetails.name,
        role: userDetails.role,
      },
      'User info fetched successfully'
    );
  }
);

export default userRoutes;
