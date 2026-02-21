import { eq, isNull } from 'drizzle-orm';
import { closeDatabaseConnection, drizzleDb } from '../db/connection';
import { ApiClientError, createApiClient, ServiceUrls } from '../helpers/api-client';
import logger from '../helpers/logger';
import { products } from '../modules/product/domain/schema';
import { productAttributes } from '../modules/product/domain/schema-attributes';
import { productVariants } from '../modules/product/domain/schema-variants';

// ============================================
// Product Seeder
// Creates 2 products:
// 1. Simple product (no variants)
// 2. Product with variants
//
// MARKETPLACE MODEL: Different owners can have products with the same name.
// Products are unique by (name, ownerId) combination.
// ============================================

/**
 * Response type for oldest user from user service
 */
interface OldestUserResponse {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: 'ADMIN' | 'USER';
  createdAt: Date;
}

/**
 * Fetches the oldest active USER from the user service via API.
 *
 * This is the ONLY method to obtain a valid owner ID for products.
 * The user service must be running and accessible.
 *
 * @returns Promise<string> - The user ID to use as owner for products
 * @throws Error if no user ID can be obtained from user service
 */
async function getOwnerId(): Promise<string> {
  // Get system auth credentials for internal API calls
  const systemUser = process.env.SYSTEM_USER || 'admin';
  const systemPass = process.env.SYSTEM_PASS || 'admin123';
  const authToken = 'Basic ' + Buffer.from(`${systemUser}:${systemPass}`).toString('base64');

  // Create API client for user service
  const userClient = createApiClient({
    baseUrl: ServiceUrls.USER_SERVICE,
    timeout: 5000,
    authToken,
  });

  try {
    logger.info('🔍 Fetching oldest USER from user service...');

    const response = await userClient.get<OldestUserResponse>(
      '/api/internal/users/oldest?role=USER'
    );

    if (response.success && response.data) {
      const userId = response.data.id;
      logger.info('✅ Successfully fetched user from user service:');
      logger.info(`   ID: ${userId}`);
      logger.info(`   Email: ${response.data.email}`);
      logger.info(`   Role: ${response.data.role}`);
      logger.info(`   Created: ${response.data.createdAt}`);
      return userId;
    }

    // If we get here, something unexpected happened
    throw new Error('Invalid response from user service');
  } catch (error) {
    if (error instanceof ApiClientError) {
      // Handle specific error cases
      if (error.code === 'USER_NOT_FOUND' || error.statusCode === 404) {
        logger.error('❌ No USER found in user service');
        logger.error('');
        logger.error('Please run the user seeder first:');
        logger.error('  cd service-user && bun run src/scripts/seed.ts');
        throw new Error('No USER found. Run user seeder first.');
      }

      if (error.code === 'NETWORK_ERROR') {
        logger.error('❌ Cannot connect to user service');
        logger.error('');
        logger.error('Troubleshooting steps:');
        logger.error('  1. Make sure service-user is running:');
        logger.error('     cd service-user && bun run dev');
        logger.error('  2. Check that USER_SERVICE_URL is correct:');
        logger.error(`     Current: ${ServiceUrls.USER_SERVICE}`);
        logger.error('  3. Verify system auth credentials (SYSTEM_USER, SYSTEM_PASS)');
        throw new Error('User service is not accessible. Please ensure it is running.');
      }

      // Unauthorized - wrong credentials
      if (error.statusCode === 401) {
        logger.error('❌ Authentication failed when calling user service');
        logger.error('Please check SYSTEM_USER and SYSTEM_PASS environment variables');
        throw new Error('User service authentication failed');
      }
    }

    // Unknown error
    logger.error('❌ Unexpected error fetching user from user service:', { error });
    throw error;
  }
}

async function seed() {
  try {
    logger.info('Starting product database seed...');
    logger.info('=====================================');
    logger.info('');

    // ============================================
    // 1. Get owner ID from user service
    // ============================================
    let ownerId: string;
    try {
      ownerId = await getOwnerId();
    } catch (error) {
      // Exit if we can't get a valid owner ID
      logger.error('');
      logger.error('❌ Cannot proceed without a valid owner ID');
      await closeDatabaseConnection();
      process.exit(1);
    }

    logger.info('');
    logger.info('=====================================');
    logger.info('');

    // ============================================
    // 2. Seed Product 1: Simple Product (No Variants)
    // ============================================
    logger.info('📦 Creating Simple Product...');
    const simpleProductName = 'Classic Cap';

    // MARKETPLACE MODEL: Check for existing product by BOTH name AND owner
    const existingSimple = await drizzleDb.query.products.findFirst({
      where: (products, { eq, and }) =>
        and(eq(products.name, simpleProductName), eq(products.ownerId, ownerId)),
    });

    if (!existingSimple) {
      const [simpleProduct] = await drizzleDb
        .insert(products)
        .values({
          name: simpleProductName,
          price: 1999, // $19.99
          ownerId: ownerId,
          stock: 150,
          hasVariant: false,
        })
        .returning();

      logger.info('✅ Simple product created:');
      logger.info(`   ID: ${simpleProduct.id}`);
      logger.info(`   Name: ${simpleProduct.name}`);
      logger.info(`   Price: $${(simpleProduct.price / 100).toFixed(2)}`);
      logger.info(`   Stock: ${simpleProduct.stock}`);
      logger.info(`   Has Variants: ${simpleProduct.hasVariant}`);
      logger.info(`   Owner ID: ${ownerId}`);
    } else {
      logger.info('⚠️  Simple product already exists for this owner. Skipping...');
    }

    logger.info('');

    // ============================================
    // 3. Seed Product 2: Product with Variants
    // ============================================
    logger.info('📦 Creating Product with Variants...');
    const variantProductName = 'Premium T-Shirt';

    // MARKETPLACE MODEL: Check for existing product by BOTH name AND owner
    const existingVariant = await drizzleDb.query.products.findFirst({
      where: (products, { eq, and }) =>
        and(eq(products.name, variantProductName), eq(products.ownerId, ownerId)),
    });

    if (!existingVariant) {
      // Create product
      const [variantProduct] = await drizzleDb
        .insert(products)
        .values({
          name: variantProductName,
          price: 2999, // $29.99 base price
          ownerId: ownerId,
          stock: 0, // Will be updated by trigger
          hasVariant: true,
        })
        .returning();

      logger.info('✅ Variant product created:');
      logger.info(`   ID: ${variantProduct.id}`);
      logger.info(`   Name: ${variantProduct.name}`);

      // Create attributes
      await drizzleDb.insert(productAttributes).values({
        productId: variantProduct.id,
        name: 'Color',
        values: ['Red', 'Blue', 'Black'],
        displayOrder: 0,
      });

      await drizzleDb.insert(productAttributes).values({
        productId: variantProduct.id,
        name: 'Size',
        values: ['S', 'M', 'L', 'XL'],
        displayOrder: 1,
      });

      logger.info('   Attributes:');
      logger.info('     - Color (Red, Blue, Black)');
      logger.info('     - Size (S, M, L, XL)');

      // Create variants
      const variantData = [
        { sku: 'TSHIRT-RED-S', price: 2999, stock: 50, color: 'Red', size: 'S' },
        { sku: 'TSHIRT-RED-M', price: 2999, stock: 75, color: 'Red', size: 'M' },
        { sku: 'TSHIRT-BLUE-M', price: 3499, stock: 60, color: 'Blue', size: 'M' },
        { sku: 'TSHIRT-BLUE-L', price: 3499, stock: 40, color: 'Blue', size: 'L' },
        { sku: 'TSHIRT-BLACK-L', price: 3999, stock: 30, color: 'Black', size: 'L' },
        { sku: 'TSHIRT-BLACK-XL', price: 3999, stock: 25, color: 'Black', size: 'XL' },
      ];

      const insertedVariants = await drizzleDb
        .insert(productVariants)
        .values(
          variantData.map(v => ({
            productId: variantProduct.id,
            sku: v.sku,
            price: v.price,
            stockQuantity: v.stock,
            isActive: true,
            attributeValues: { Color: v.color, Size: v.size },
          }))
        )
        .returning();

      logger.info(`   Variants: ${insertedVariants.length} SKUs created`);
      insertedVariants.forEach(v => {
        logger.info(
          `     - ${v.sku}: $${((v.price || 0) / 100).toFixed(2)} (stock: ${v.stockQuantity})`
        );
      });

      // Get updated product (trigger should have updated stock if it exists)
      const [updatedProduct] = await drizzleDb
        .select()
        .from(products)
        .where(eq(products.id, variantProduct.id));

      logger.info(`   Total Stock: ${updatedProduct.stock}`);
      logger.info(`   Price Range: $29.99 - $39.99`);
      logger.info(`   Owner ID: ${ownerId}`);
    } else {
      logger.info('⚠️  Variant product already exists for this owner. Skipping...');
    }

    // ============================================
    // 4. Summary
    // ============================================
    logger.info('');
    logger.info('=====================================');
    const allProducts = await drizzleDb.select().from(products).where(isNull(products.deletedAt));

    logger.info('📊 Seeding Summary:');
    logger.info(`   Total Products: ${allProducts.length}`);
    logger.info(`   Simple Products: ${allProducts.filter(p => !p.hasVariant).length}`);
    logger.info(`   Products with Variants: ${allProducts.filter(p => p.hasVariant).length}`);
    logger.info('=====================================');

    await closeDatabaseConnection();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Failed to seed product database', { error });
    await closeDatabaseConnection();
    process.exit(1);
  }
}

seed();
