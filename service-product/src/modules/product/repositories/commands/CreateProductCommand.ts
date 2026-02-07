import { Service } from 'typedi';
import { CreateProductRequest as CreateProductInput } from '../../domain/schema';
import { productCreatedProducer } from '../../events/product-events';
import { ProductRepository } from '../ProductRepository';

@Service()
export class CreateProductCommand {
  constructor(private productRepository: ProductRepository) {}

  async execute(data: CreateProductInput & { ownerId: string }) {
    // Create product
    // The repository expects specific fields, we pass data directly assuming validation ensures types match
    const product = await this.productRepository.create({
      name: data.name,
      price: data.price,
      ownerId: data.ownerId,
    });

    // Emit Kafka event
    await productCreatedProducer(product);

    return product;
  }
}
