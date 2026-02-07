import { Service } from 'typedi';
import { productRestoredProducer } from '../../events/product-events';
import { ProductRepository } from '../ProductRepository';

@Service()
export class RestoreProductCommand {
  constructor(private productRepository: ProductRepository) {}

  async execute(id: string, ownerId: string) {
    // Verify ownership before restoration (include deleted records for verification)
    const product = await this.productRepository.findByIdWithDeleted(id);
    if (!product || product.ownerId !== ownerId) {
      throw new Error('Product not found or access denied');
    }

    // Restore product
    const success = await this.productRepository.restore(id);
    if (!success) {
      throw new Error('Failed to restore product');
    }

    // Emit Kafka event
    await productRestoredProducer(id, ownerId);

    // Return the restored product
    return await this.productRepository.findById(id);
  }
}
