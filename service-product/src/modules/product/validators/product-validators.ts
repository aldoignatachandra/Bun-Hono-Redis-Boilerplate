import { z } from 'zod';

// ============================================
// Attribute Validation Schemas
// ============================================

export const createAttributeSchema = z.object({
  name: z.string().min(1, 'Attribute name is required').max(100, 'Attribute name too long'),
  values: z.array(z.string().min(1).max(255)).min(1, 'At least one value is required'),
  displayOrder: z.number().int().min(0).optional(),
});

// ============================================
// Variant Validation Schemas
// ============================================

export const createVariantSchema = z.object({
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(100, 'SKU too long')
    .regex(/^[A-Za-z0-9\-_]+$/, 'SKU can only contain letters, numbers, hyphens, and underscores'),
  price: z.number().positive('Price must be positive').nullable().optional(),
  stock: z.number().int('Stock must be an integer').min(0, 'Stock cannot be negative').optional(),
  isActive: z.boolean().optional(),
  attributeValues: z.record(z.string(), z.string(), {
    message: 'Attribute values must be an object with string keys and values',
  }),
});

export const updateVariantSchema = z.object({
  sku: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9\-_]+$/)
    .optional(),
  price: z.number().positive().nullable().optional(),
  stock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  attributeValues: z.record(z.string(), z.string()).optional(),
});

// ============================================
// Product Validation Schemas
// ============================================

export const createProductSchema = z
  .object({
    name: z.string().min(1, 'Product name is required').max(255, 'Product name too long'),
    price: z.number().positive('Price must be positive'),
    ownerId: z.string().uuid('Invalid owner ID'),
    stock: z.number().int().min(0, 'Stock cannot be negative').optional(),
    attributes: z.array(createAttributeSchema).optional(),
    variants: z.array(createVariantSchema).optional(),
  })
  .refine(
    data => {
      // If variants exist, attributes must also exist
      if (data.variants && data.variants.length > 0) {
        return data.attributes && data.attributes.length > 0;
      }
      return true;
    },
    {
      message: 'Attributes are required when creating variants',
      path: ['attributes'],
    }
  );

export const updateProductSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    price: z.number().int().positive().optional(),
    ownerId: z.string().uuid().optional(),
    stock: z.number().int().min(0).optional(),
    attributes: z.array(createAttributeSchema).optional(),
    variants: z.array(createVariantSchema).optional(),
  })
  .refine(
    data => {
      // If variants are provided, attributes must also be provided
      if (data.variants !== undefined && data.variants.length > 0) {
        return data.attributes !== undefined && data.attributes.length > 0;
      }
      return true;
    },
    {
      message: 'Attributes are required when updating variants',
      path: ['attributes'],
    }
  );

// ============================================
// Query Parameter Validation
// ============================================

export const productQuerySchema = z.object({
  ownerId: z.string().uuid().optional(),
  search: z.string().max(255).optional(),
  hasVariant: z
    .enum(['true', 'false'])
    .optional()
    .transform(v => v === 'true'),
  inStock: z
    .enum(['true', 'false'])
    .optional()
    .transform(v => v === 'true'),
  minPrice: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform(v => (v ? parseInt(v) : undefined)),
  maxPrice: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform(v => (v ? parseInt(v) : undefined)),
  includeVariants: z
    .enum(['true', 'false'])
    .optional()
    .transform(v => v === 'true'),
  limit: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform(v => (v ? parseInt(v) : 10)),
  offset: z
    .string()
    .regex(/^\d+$/)
    .optional()
    .transform(v => (v ? parseInt(v) : 0)),
});
