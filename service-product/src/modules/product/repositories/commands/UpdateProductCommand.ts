import { Service } from 'typedi';
import { productUpdatedProducer } from '../../events/product-events';
import { ProductRepository } from '../ProductRepository';

@Service()
export class UpdateProductCommand {
  constructor(private productRepository: ProductRepository) {}

  async execute(id: string, data: any, _ownerId: string) {
    // Update product
    const product = await this.productRepository.update(id, data);

    if (!product) {
      throw new Error('Product not found or access denied');
    }

    // Emit Kafka event
    await productUpdatedProducer(product);

    return product;
  }
}
