import { Service } from 'typedi';
import { CreateUserInput } from '../../domain/auth';
import type { UserResponse } from '../../domain/schema';
import { userCreatedProducer } from '../../events/user-events';
import { UserRepository } from '../UserRepository';
import { hashPassword } from '../../../../helpers/password';
import { RequestMetadata } from '../../../../helpers/request-metadata';

@Service()
export class CreateUserCommand {
  constructor(private userRepository: UserRepository) {}

  async execute(data: CreateUserInput, metadata?: RequestMetadata): Promise<UserResponse> {
    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await this.userRepository.create({
      email: data.email,
      username: data.username,
      name: data.name,
      password: hashedPassword,
      role: data.role || 'USER',
    });

    // [Kafka] Send 'user.created' event to message broker to notify other services
    await userCreatedProducer({
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...metadata,
    });

    return user;
  }
}
