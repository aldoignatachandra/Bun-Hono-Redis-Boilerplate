import { SeedData } from '../types';

/**
 * Development environment seed data
 */
export const devSeedData: SeedData = {
  users: [
    {
      id: 'admin-1',
      email: 'admin@example.com',
      password: '$2b$12$hashedpassword',
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
    {
      id: 'user-1',
      email: 'user@example.com',
      password: '$2b$12$hashedpassword',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  ],
  products: [
    {
      id: 'product-1',
      name: 'Sample Product 1',
      price: 100,
      ownerId: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    },
  ],
};
