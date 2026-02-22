import { Hono } from 'hono';
import { Container } from 'typedi';
import { errorResponse, successResponse } from '../../../helpers/api-response';
import { getRequestMetadata } from '../../../helpers/request-metadata';
import { JWTPayload } from '../../../helpers/types';
import { auth, requireRole } from '../../../middlewares/auth';
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

// Protected admin routes
userRoutes.use('/admin/*', auth, requireRole('ADMIN'));

// Create user (admin only)
userRoutes.post('/admin/users', async c => {
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
    return errorResponse(c, 'Failed to create user', 'USER_CREATE_FAILED', 400, error);
  }
});

// Get users (admin only)
userRoutes.get('/admin/users', auth, requireRole('ADMIN'), async c => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const includeDeleted = c.req.query('includeDeleted') === 'true';

    const offset = (page - 1) * limit;

    const userRepository = Container.get(UserRepository);
    const users = await userRepository.findAll({
      includeDeleted,
      limit,
      offset,
    });

    return successResponse(c, users, 'Users fetched successfully', 200, {
      page,
      limit,
      count: users.length,
    });
  } catch (error) {
    return errorResponse(c, 'Failed to fetch users', 'USER_FETCH_FAILED', 500, error);
  }
});

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
userRoutes.delete('/admin/users/:id', auth, requireRole('ADMIN'), async c => {
  try {
    const userId = c.req.param('id');
    const force = c.req.query('force') === 'true';

    const deleteUserCommand = Container.get(DeleteUserCommand);
    await deleteUserCommand.execute(userId, force);

    return successResponse(
      c,
      {
        userId,
        force,
      },
      force ? 'User permanently deleted' : 'User soft deleted'
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse(c, 'User not found', 'USER_NOT_FOUND', 404);
    }
    return errorResponse(c, 'Failed to delete user', 'USER_DELETE_FAILED', 500, error);
  }
});

// Restore soft-deleted user (admin only)
userRoutes.post('/admin/users/:id/restore', auth, requireRole('ADMIN'), async c => {
  try {
    const userId = c.req.param('id');

    const restoreUserCommand = Container.get(RestoreUserCommand);
    const restoredUser = await restoreUserCommand.execute(userId);

    return successResponse(c, { user: restoredUser }, 'User restored successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse(c, 'User not found', 'USER_NOT_FOUND', 404);
    }
    return errorResponse(c, 'Failed to restore user', 'USER_RESTORE_FAILED', 500, error);
  }
});

// Get current user info
userRoutes.get('/me', auth, async c => {
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
});

export default userRoutes;
