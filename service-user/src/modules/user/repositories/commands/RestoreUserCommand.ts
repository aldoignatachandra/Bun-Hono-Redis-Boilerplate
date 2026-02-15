import { Service } from 'typedi';
import { userRestoredProducer } from '../../events/user-events';
import { UserRepository } from '../UserRepository';

@Service()
export class RestoreUserCommand {
  constructor(private userRepository: UserRepository) {}

  async execute(id: string) {
    // Check if user exists and was deleted
    const deletedUser = await this.userRepository.findByIdWithDeleted(id);

    if (!deletedUser) {
      throw new Error('User not found');
    }

    // Restore user
    const success = await this.userRepository.restore(id);
    if (!success) {
      throw new Error('Failed to restore user');
    }

    // [Kafka] Send 'user.restored' event to message broker to notify other services
    await userRestoredProducer({
      id: deletedUser.id,
      email: deletedUser.email,
      role: deletedUser.role,
      createdAt: deletedUser.createdAt,
      updatedAt: deletedUser.updatedAt,
    });

    // Return the restored user
    return await this.userRepository.findById(id);
  }
}
