import { Service } from 'typedi';
import { UserEventPublisher } from '../../events/UserEventPublisher';
import { UserRepository } from '../UserRepository';

@Service()
export class RestoreUserCommand {
  constructor(
    private userRepository: UserRepository,
    private userEventPublisher: UserEventPublisher
  ) {}

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

    // Emit Kafka event
    await this.userEventPublisher.publishUserRestored({
      id: deletedUser.id,
      email: deletedUser.email,
      role: deletedUser.role,
      createdAt: deletedUser.createdAt,
      restoredAt: new Date(),
    });

    // Return the restored user
    return await this.userRepository.findById(id);
  }
}
