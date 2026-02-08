import { Hono } from 'hono';
import { Container } from 'typedi';
import { JWTPayload } from '../../../helpers/types';
import { auth, requireRole } from '../../../middlewares/auth';
import { CreateUserSchema } from '../domain/auth';
import { CreateUserCommand } from '../repositories/commands/CreateUserCommand';
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

    const createUserCommand = Container.get(CreateUserCommand);
    const user = await createUserCommand.execute(validatedData);

    return c.json({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (error) {
    return c.text('Failed to create user', 400);
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

    return c.json({
      data: users,
      meta: {
        page,
        limit,
        count: users.length,
      },
    });
  } catch (error) {
    return c.text('Failed to fetch users', 500);
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
      return c.text('User not found', 404);
    }

    return c.json(user);
  } catch (error) {
    return c.text('Failed to fetch user', 500);
  }
});

// Soft delete user (admin only)
userRoutes.delete('/admin/users/:id', auth, requireRole('ADMIN'), async c => {
  try {
    const userId = c.req.param('id');
    const force = c.req.query('force') === 'true';

    const userRepository = Container.get(UserRepository);
    const success = await userRepository.delete(userId, force);

    if (!success) {
      return c.text('User not found', 404);
    }

    return c.json({
      message: force ? 'User permanently deleted' : 'User soft deleted',
      userId,
      force,
    });
  } catch (error) {
    return c.text('Failed to delete user', 500);
  }
});

// Restore soft-deleted user (admin only)
userRoutes.post('/admin/users/:id/restore', auth, requireRole('ADMIN'), async c => {
  try {
    const userId = c.req.param('id');

    const restoreUserCommand = Container.get(RestoreUserCommand);
    const restoredUser = await restoreUserCommand.execute(userId);

    return c.json({
      message: 'User restored successfully',
      user: restoredUser,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return c.text('User not found', 404);
    }
    return c.text('Failed to restore user', 500);
  }
});

// Get current user info
userRoutes.get('/me', auth, async c => {
  const user = c.get('user') as JWTPayload;

  const getUserQuery = Container.get(GetUserQuery);
  const userDetails = await getUserQuery.execute(user.sub);

  if (!userDetails) {
    return c.text('User not found', 404);
  }

  return c.json({
    id: userDetails.id,
    email: userDetails.email,
    role: userDetails.role,
  });
});

export default userRoutes;
