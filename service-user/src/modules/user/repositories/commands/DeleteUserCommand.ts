import { Service } from 'typedi';
import { userDeletedProducer } from '../../events/user-events';
import { UserRepository } from '../UserRepository';

@Service()
export class DeleteUserCommand {
  constructor(private userRepository: UserRepository) {}

  async execute(id: string, force: boolean = false) {
    const success = await this.userRepository.delete(id, force);

    if (!success) {
      throw new Error('User not found');
    }

    // [Kafka] Send 'user.deleted' event to message broker to notify other services
    await userDeletedProducer(id, force);

    return success;
  }
}
