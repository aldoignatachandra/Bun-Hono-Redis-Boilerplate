import { Service } from 'typedi';
import { RequestMetadata } from '../../../../helpers/request-metadata';
import { productUpdatedProducer } from '../../events/product-events';
import { ProductRepository } from '../ProductRepository';

@Service()
export class UpdateProductCommand {
  constructor(private productRepository: ProductRepository) {}

  async execute(id: string, data: any, ownerId: string, metadata?: RequestMetadata) {
    // 1. Verify ownership
    const existingProduct = await this.productRepository.findById(id);
    if (!existingProduct || existingProduct.ownerId !== ownerId) {
      throw new Error('Product not found or access denied');
    }

    // Update product
    const product = await this.productRepository.update(id, data);

    if (!product) {
      throw new Error('Product not found or access denied');
    }

    // [Kafka] Send 'product.updated' event to message broker to notify other services
    await productUpdatedProducer({
      ...product,
      ...metadata,
    });

    return product;
  }
}
