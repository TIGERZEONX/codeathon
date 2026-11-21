import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.string().min(1, 'Role ID or name is required'),
  contestScope: z.array(z.string()).optional().default([]), // specific contests or empty for global
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = createUserSchema.partial().omit({ email: true });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
