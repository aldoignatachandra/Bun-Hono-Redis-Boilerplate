# Paranoid Functionality Implementation

This document describes the comprehensive paranoid (soft delete) functionality implemented across both user and product services.

## Overview

The paranoid functionality provides soft delete capabilities with the following features:

- Soft delete by default (sets `deletedAt` timestamp)
- Hard delete option (permanent deletion)
- Restore soft-deleted records
- Query filtering based on deletion status
- Comprehensive error handling
- Enhanced API responses with paranoid metadata

## Architecture

### Core Components

1. **Base Repository with Paranoid Support** (`packages/drizzle/src/repositories/base-repository.ts`)
   - Implements paranoid query building
   - Provides `onlyActive`, `includeDeleted`, `onlyDeleted` options
   - Handles soft delete and restore operations

2. **Paranoid Query Helpers** (`packages/drizzle/src/paranoid/query-helpers.ts`)
   - `ParanoidQueryBuilder` class for building paranoid queries
   - Validation of paranoid options
   - Where clause generation for different scenarios

3. **Enhanced Error Handling** (`packages/common/src/paranoid-errors.ts`)
   - `ParanoidError` base class
   - Specific error types for different scenarios
   - Validation functions for paranoid operations

4. **Response Type System** (`packages/common/src/paranoid-responses.ts`)
   - Standardized response formats
   - Paranoid metadata inclusion
   - Operation result tracking

## API Endpoints

### User Service (`apps/user-service`)

#### Authentication Routes

- `POST /login` - Login (includes deleted records for authentication)
- `GET /me` - Get current user (active only)

#### Admin Routes

- `GET /admin/users` - List users with paranoid options
  - Query parameters:
    - `includeDeleted=true|false` - Include soft-deleted records
    - `onlyDeleted=true|false` - Only deleted records
    - `role=ADMIN|USER` - Filter by role
- `GET /admin/users/:id` - Get user by ID with paranoid options
  - Query parameters:
    - `includeDeleted=true|false` - Include soft-deleted records
- `DELETE /admin/users/:id` - Delete user (soft by default)
  - Query parameters:
    - `force=true|false` - Hard delete when true
- `POST /admin/users/:id/restore` - Restore soft-deleted user

### Product Service (`apps/product-service`)

#### Product Routes

- `POST /products` - Create product
- `GET /products` - List user's products with paranoid options
  - Query parameters:
    - `includeDeleted=true|false` - Include soft-deleted records
    - `onlyDeleted=true|false` - Only deleted records
    - `search=query` - Search by name
    - `minPrice=number` - Minimum price filter
    - `maxPrice=number` - Maximum price filter
- `GET /products/:id` - Get product by ID with paranoid options
  - Query parameters:
    - `includeDeleted=true|false` - Include soft-deleted records
- `PATCH /products/:id` - Update product (owner only)
- `DELETE /products/:id` - Delete product (soft by default)
  - Query parameters:
    - `force=true|false` - Hard delete when true
- `POST /products/:id/restore` - Restore soft-deleted product
- `GET /products/search` - Search products with paranoid options

## Query Options

### Paranoid Options

```typescript
interface ParanoidOptions {
  includeDeleted?: boolean; // Include both active and deleted records
  onlyDeleted?: boolean; // Only deleted records
  onlyActive?: boolean; // Only active records (default)
}
```

### Validation Rules

1. **Mutually Exclusive**: Only one of `includeDeleted`, `onlyDeleted`, or `onlyActive` can be true
2. **Default Behavior**: When no option is specified, `onlyActive: true` is assumed
3. **Error Handling**: Invalid combinations throw `InvalidParanoidOptionsError`

## Repository Methods

### Enhanced Methods

```typescript
// User Repository
async findById(id: string, options?: UserRepositoryOptions): Promise<UserWithProductsResponse | null>
async findByEmail(email: string, options?: UserRepositoryOptions): Promise<UserResponse | null>
async findAll(options?: UserRepositoryOptions): Promise<UserWithProductsResponse[]>
async delete(id: string, force?: boolean): Promise<boolean>
async restore(id: string): Promise<boolean>

// Product Repository
async findById(id: string, options?: ProductRepositoryOptions): Promise<ProductResponse | null>
async findByOwner(ownerId: string, options?: ProductRepositoryOptions): Promise<ProductResponse[]>
async delete(id: string, force?: boolean): Promise<boolean>
async restore(id: string): Promise<boolean>
```

### Specialized Methods

```typescript
// Include deleted records
async findByIdWithDeleted(id: string): Promise<T | null>
async findAllWithDeleted(options?: RepositoryOptions): Promise<T[]>

// Only deleted records
async findDeletedOnly(options?: RepositoryOptions): Promise<T[]>

// Search with paranoid options
async searchWithDeleted(query: string): Promise<T[]>
async searchDeletedOnly(query: string): Promise<T[]>
```

## Error Handling

### Error Types

1. **SoftDeletedError** - Resource is soft deleted and access is attempted
2. **ResourceNotFoundError** - Resource not found
3. **AccessDeniedError** - Insufficient permissions
4. **InvalidParanoidOptionsError** - Invalid query parameter combination

### Error Response Format

```typescript
interface ParanoidErrorResponse {
  error: {
    code: string;
    message: string;
    details?: {
      resource?: string;
      id?: string;
      paranoid?: ParanoidOptions;
    };
  };
  meta: {
    timestamp: string;
    requestId?: string;
  };
}
```

## Response Formats

### Standard Response

```typescript
interface ParanoidResponse<T> {
  data: T;
  meta: {
    paranoid: ParanoidOptions;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    timestamp: string;
    requestId?: string;
  };
}
```

### List Response

```typescript
interface ParanoidListResponse<T> extends ParanoidResponse<T[]> {
  meta: ParanoidResponse<T[]>['meta'] & {
    count: number;
    filters?: Record<string, any>;
  };
}
```

## Event Publishing

### User Events

- `user.created` - User created
- `user.restored` - User restored from soft delete

### Product Events

- `product.created` - Product created
- `product.updated` - Product updated
- `product.deleted` - Product soft/hard deleted
- `product.restored` - Product restored from soft delete

## Usage Examples

### Basic Queries

```typescript
// Only active records (default)
const activeUsers = await userRepository.findAll();

// Include deleted records
const allUsers = await userRepository.findAll({ includeDeleted: true });

// Only deleted records
const deletedUsers = await userRepository.findAll({ onlyDeleted: true });
```

### Search with Filters

```typescript
// Search active products
const activeProducts = await productRepository.searchProducts('laptop');

// Search including deleted
const allProducts = await productRepository.searchProductsWithDeleted('laptop');

// Search only deleted
const deletedProducts = await productRepository.searchProducts('laptop', { onlyDeleted: true });
```

### Restore Operations

```typescript
// Restore user
await userRepository.restore('user-id');

// Restore product
await productRepository.restore('product-id');
```

## Testing

Comprehensive test suite is available at `test/paranoid-functionality.test.ts` covering:

- Repository method behavior
- Query parameter validation
- Error handling scenarios
- Response format validation
- API endpoint behavior
- Integration scenarios

Run tests with:

```bash
bun test test/paranoid-functionality.test.ts
```

## Migration Guide

### For Existing APIs

1. **Add Paranoid Options**: Update method signatures to accept `ParanoidOptions`
2. **Update Queries**: Use `ParanoidQueryBuilder` for where clauses
3. **Handle Soft Deletes**: Use `delete(id, false)` instead of hard deletes
4. **Add Restore Endpoints**: Implement restore functionality where needed
5. **Update Error Handling**: Use new error types and response formats

### Database Considerations

1. **Index Strategy**: Consider adding indexes on `deletedAt` for performance
2. **Query Optimization**: Use appropriate where clauses for deleted filtering
3. **Data Integrity**: Ensure foreign key constraints handle soft deletes properly

## Best Practices

1. **Default to Active**: Always exclude deleted records unless explicitly requested
2. **Validate Options**: Check for mutually exclusive paranoid options
3. **Consistent Responses**: Use standardized response formats with paranoid metadata
4. **Proper Error Codes**: Use appropriate HTTP status codes (410 for soft deleted)
5. **Event Publishing**: Emit appropriate events for restore operations
6. **Ownership Checks**: Verify ownership for restore operations
7. **Audit Logging**: Log all restore and hard delete operations

## Security Considerations

1. **Access Control**: Restore operations should require appropriate permissions
2. **Audit Trail**: Maintain audit logs for restore operations
3. **Data Privacy**: Ensure deleted data is properly handled per privacy requirements
4. **Rate Limiting**: Consider rate limiting restore operations
5. **Validation**: Validate restore requests to prevent unauthorized access

## Performance Considerations

1. **Query Optimization**: Use appropriate indexes for `deletedAt` queries
2. **Pagination**: Implement proper pagination for large result sets
3. **Caching**: Consider caching strategies for frequently accessed active records
4. **Batch Operations**: Use batch operations for bulk restore/delete operations
5. **Monitoring**: Monitor performance of paranoid queries
