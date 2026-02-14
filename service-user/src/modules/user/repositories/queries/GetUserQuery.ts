import { Service } from 'typedi';
import type { UserResponse } from '../../domain/schema';
import { UserRepository, type UserRepositoryOptions } from '../UserRepository';

@Service()
export class GetUserQuery {
  constructor(private userRepository: UserRepository) {}

  async execute(id: string, options: UserRepositoryOptions = {}): Promise<UserResponse | null> {
    return this.userRepository.findById(id, options);
  }

  async executeByEmail(
    email: string,
    options: UserRepositoryOptions = {}
  ): Promise<UserResponse | null> {
    return this.userRepository.findByEmail(email, options);
  }

  // Method to include deleted records (needed for restore operation)
  async executeWithDeleted(id: string): Promise<UserResponse | null> {
    return this.userRepository.findByIdWithDeleted(id);
  }
}
