export * from './db/index';
export * from './migrations/index';
export * from './paranoid/index';
export * from './repositories/index';
export * from './schema/index';
export type {
  BatchOptions,
  BatchResult,
  DatabaseConfig,
  DatabaseError,
  DateRange,
  FilterOptions,
  IRepository,
  QueryResult,
  SortOptions,
  TransactionOptions,
  calculatePaginationOffset,
  createPaginatedResult,
  createQueryResult,
  formatExecutionTime,
  isDatabaseEntity,
  isParanoidEntity,
  isRepositoryOptions,
  isValidDateRange,
  isValidPriceRange,
  sanitizeErrorMessage,
} from './types/index';

export type {
  CreateProductRequest,
  CreateUserRequest,
  NewProduct,
  NewUser,
  Product,
  ProductQueryOptions,
  ProductResponse,
  ProductWithOwnerResponse,
  UpdateProduct,
  UpdateProductRequest,
  UpdateUser,
  UpdateUserRequest,
  User,
  UserQueryOptions,
  UserResponse,
  UserWithProductsResponse,
} from './schema/entities';

export type { ParanoidOptions } from './paranoid/query-helpers';
export type { Role } from './schema/core/enums';

export { checkDatabaseHealth, closeDatabaseConnection, drizzleDb } from './db/connection';

export {
  ParanoidQueryBuilder,
  type ParanoidOptions as DrizzleParanoidOptions,
} from './paranoid/query-helpers';

export { productRepository } from './repositories/product-repository';
export { userRepository } from './repositories/user-repository';
