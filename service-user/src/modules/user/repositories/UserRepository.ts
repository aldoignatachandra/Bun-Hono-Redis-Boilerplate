import { Service } from 'typedi';
import type { NewUser, UpdateUser, User, UserResponse } from '../domain/schema';
import { UserRepository as DrizzleUserRepository } from './drizzle-repo';

// Type for authentication that includes password
export interface UserResponseWithPassword extends UserResponse {
  password: string;
}

export interface UserRepositoryOptions {
  includeDeleted?: boolean;
}

@Service()
export class UserRepository {
  private drizzleUserRepository: DrizzleUserRepository;

  constructor() {
    this.drizzleUserRepository = new DrizzleUserRepository();
  }

  async create(data: {
    email: string;
    password: string;
    role?: 'ADMIN' | 'USER';
  }): Promise<UserResponse> {
    const user = await this.drizzleUserRepository.create(data as NewUser);
    return this.mapToResponse(user);
  }

  async findById(id: string, options: UserRepositoryOptions = {}): Promise<UserResponse | null> {
    const user = await this.drizzleUserRepository.findById(id, options.includeDeleted);
    return user ? this.mapToResponse(user) : null;
  }

  async findByEmail(
    email: string,
    options: UserRepositoryOptions = {},
    includePassword: boolean = false
  ): Promise<UserResponse | null> {
    const user = await this.drizzleUserRepository.findByEmail(email);
    if (!user) return null;

    // Check for deleted
    if (!options.includeDeleted && user.deletedAt) return null;

    if (includePassword) {
      return user as unknown as UserResponseWithPassword;
    }
    return this.mapToResponse(user);
  }

  // Method specifically for authentication that returns user with password
  async findByEmailForAuth(email: string): Promise<UserResponseWithPassword | null> {
    const user = await this.drizzleUserRepository.findByEmail(email);
    if (!user || user.deletedAt) return null;
    return user as unknown as UserResponseWithPassword;
  }

  async update(
    id: string,
    data: Partial<UpdateUser>,
    _options: UserRepositoryOptions = {}
  ): Promise<UserResponse | null> {
    // drizzle update doesn't take options for find, it just updates by ID
    // but we might want to check if it exists/is not deleted first if we were strict
    const user = await this.drizzleUserRepository.update(id, data as UpdateUser);
    return user ? this.mapToResponse(user) : null;
  }

  async delete(id: string, force: boolean = false): Promise<boolean> {
    if (force) {
      return this.drizzleUserRepository.hardDelete(id);
    }
    return this.drizzleUserRepository.softDelete(id);
  }

  // Restore a soft-deleted user
  async restore(id: string): Promise<boolean> {
    return this.drizzleUserRepository.restore(id);
  }

  async findAll(
    options: UserRepositoryOptions & { limit?: number; offset?: number } = {}
  ): Promise<UserResponse[]> {
    const users = await this.drizzleUserRepository.findAll({
      includeDeleted: options.includeDeleted,
      limit: options.limit,
      offset: options.offset,
    });
    return users.map(user => this.mapToResponse(user));
  }

  // Find a user including deleted records (needed for restore operation)
  async findByIdWithDeleted(id: string): Promise<UserResponse | null> {
    const user = await this.drizzleUserRepository.findById(id, true);
    return user ? this.mapToResponse(user) : null;
  }

  private mapToResponse(user: User): UserResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest as UserResponse;
  }
}
