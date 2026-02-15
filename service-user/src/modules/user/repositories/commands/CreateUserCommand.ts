import bcrypt from 'bcrypt';
import { Service } from 'typedi';
import { CreateUserInput } from '../../domain/auth';
import type { UserResponse } from '../../domain/schema';
import { userCreatedProducer } from '../../events/user-events';
import { UserRepository } from '../UserRepository';

@Service()
export class CreateUserCommand {
  constructor(private userRepository: UserRepository) {}

  async execute(data: CreateUserInput): Promise<UserResponse> {
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await this.userRepository.create({
      email: data.email,
      password: hashedPassword,
      role: data.role || 'USER',
    });

    // [Kafka] Send 'user.created' event to message broker to notify other services
    await userCreatedProducer(user);

    return user;
  }
}
