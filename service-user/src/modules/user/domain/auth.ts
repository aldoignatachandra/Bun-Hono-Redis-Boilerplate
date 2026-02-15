import { z } from 'zod';
import { PasswordSchema } from '../../../helpers/password';

// Base user schema for this service
const BaseUserSchema = z.object({
  id: z.string().optional(),
  email: z.string().email('Invalid email format'),
  username: z.string().min(3, 'Username must be at least 3 characters').max(50),
  name: z.string().min(1, 'Name is required').max(255).optional(),
  password: PasswordSchema,
  role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

// User authentication validation schemas
export const LoginSchema = BaseUserSchema.pick({
  email: true,
}).extend({
  password: z.string().min(1, 'Password is required'), // Login doesn't need strict validation, just presence
});

export const CreateUserSchema = BaseUserSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
});

export const UpdateUserSchema = BaseUserSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  email: true,
  username: true, // Typically username is also immutable or requires checks
})
  .extend({
    email: z.string().email('Invalid email format').optional(),
    username: z.string().min(3).max(50).optional(),
    name: z.string().min(1).max(255).optional(),
    password: PasswordSchema.optional(),
    role: z.enum(['ADMIN', 'USER']).optional(),
  })
  .partial();

// Type exports
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
