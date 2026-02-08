import { z } from 'zod';

// Base user schema for this service
const BaseUserSchema = z.object({
  id: z.string().optional(),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'USER']).optional().default('USER'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

// User authentication validation schemas
export const LoginSchema = BaseUserSchema.pick({
  email: true,
}).extend({
  password: z.string().min(6, 'Password must be at least 6 characters'),
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
  email: true, // Email usually shouldn't be updated via simple update, or if so, requires verification
})
  .extend({
    email: z.string().email('Invalid email format').optional(),
    password: z.string().min(6, 'Password must be at least 6 characters').optional(),
    role: z.enum(['ADMIN', 'USER']).optional(),
  })
  .partial();

// Type exports
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
