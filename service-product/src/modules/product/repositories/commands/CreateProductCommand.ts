import { Service } from 'typedi';
import { RequestMetadata } from '../../../../helpers/request-metadata';
import { CreateProductRequest as CreateProductInput } from '../../domain/schema';
import { productCreatedProducer } from '../../events/product-events';
import { ProductRepository } from '../ProductRepository';

@Service()
export class CreateProductCommand {
  constructor(private productRepository: ProductRepository) {}

  async execute(data: CreateProductInput & { ownerId: string }, metadata?: RequestMetadata) {
    // Create product
    // The repository expects specific fields, we pass data directly assuming validation ensures types match
    const product = await this.productRepository.create({
      name: data.name,
      price: data.price,
      ownerId: data.ownerId,
    });

    // [Kafka] Send 'product.created' event to message broker to notify other services
    await productCreatedProducer({
      ...product,
      ...metadata,
    });

    return product;
  }
}
