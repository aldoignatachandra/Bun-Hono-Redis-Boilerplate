import { Service } from 'typedi';
import { productDeletedProducer } from '../../events/product-events';
import { ProductRepository } from '../ProductRepository';

@Service()
export class DeleteProductCommand {
  constructor(private productRepository: ProductRepository) {}

  async execute(id: string, ownerId: string, force: boolean = false) {
    // Verify ownership before deletion (include deleted records for verification)
    const product = await this.productRepository.findByIdWithDeleted(id);
    if (!product || product.ownerId !== ownerId) {
      throw new Error('Product not found or access denied');
    }

    // Delete product
    await this.productRepository.delete(id, force);

    // Emit Kafka event
    await productDeletedProducer(id, ownerId);
  }
}
