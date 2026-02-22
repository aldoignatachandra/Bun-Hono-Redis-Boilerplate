# Product Service API Documentation

> **Service Name:** Product Service
>
> **Version:** 1.0.0
>
> **Base URL:** `http://localhost:3102`
>
> **Port:** 3102

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Error Codes](#error-codes)
- [Data Models](#data-models)
- [Marketplace Model](#marketplace-model)
- [Examples](#examples)

---

## Overview

The Product Service is responsible for:

- **Product Management**: CRUD operations for products
- **Marketplace Model**: Multi-owner product catalog
- **Product Variants**: Support for products with multiple SKUs (Size, Color, etc.)
- **Product Attributes**: Configurable attributes for variable products
- **Search & Filter**: Advanced product search capabilities

### Key Features

| Feature                | Description                                          |
| ---------------------- | ---------------------------------------------------- |
| **Marketplace Model**  | Multiple owners can have products with the same name |
| **Soft Delete**        | Products can be soft-deleted and restored            |
| **Owner-Based Access** | Users can only access their own products             |
| **Product Variants**   | Support for SKUs with different attributes           |
| **Advanced Search**    | Search by name, price range, and filters             |
| **Stock Management**   | Track product inventory                              |

---

## Authentication

### 1. JWT Authentication

Required for all product endpoints.

**Header Format:**

```
Authorization: Bearer <jwt-token>
```

**Token Structure:**

```typescript
{
  sub: string; // User ID
  email: string; // User email
  role: "ADMIN" | "USER";
  jti: string; // Session ID
  iat: number; // Issued at
  exp: number; // Expires at
}
```

### 2. System Authentication

Required for admin health check endpoint.

**Header Format:**

```
Authorization: Basic <base64(SYSTEM_USER:SYSTEM_PASS)>
```

**Environment Variables:**

```bash
SYSTEM_USER=admin
SYSTEM_PASS=admin123
```

### 3. Access Control

| Role    | Access                                      |
| ------- | ------------------------------------------- |
| `USER`  | Can access own products only                |
| `ADMIN` | Can access all products regardless of owner |

---

## Endpoints

### 1. Health Check

**Public endpoint** to check service health.

| Attribute         | Value     |
| ----------------- | --------- |
| **Method**        | `GET`     |
| **Path**          | `/health` |
| **Auth Required** | ❌ No     |

#### Request

```http
GET /health HTTP/1.1
Host: localhost:3102
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "service": "product-service",
    "environment": "development",
    "database": "connected",
    "timestamp": "2026-02-21T10:00:00.000Z"
  }
}
```

---

### 2. Admin Health Check

**Protected endpoint** for detailed health monitoring.

| Attribute         | Value           |
| ----------------- | --------------- |
| **Method**        | `GET`           |
| **Path**          | `/admin/health` |
| **Auth Required** | ✅ System Auth  |

#### Request

```http
GET /admin/health HTTP/1.1
Host: localhost:3102
Authorization: Basic YWRtaW46YWRtaW4xMjM=
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Admin health check passed",
  "data": {
    "service": "product-service",
    "mode": "admin",
    "config": {
      "db": "connected",
      "kafka": "connected"
    },
    "timestamp": "2026-02-21T10:00:00.000Z"
  }
}
```

---

### 3. Create Product

Creates a new product owned by the authenticated user. Supports both **Simple Products** and **Variable Products**.

| Attribute         | Value             |
| ----------------- | ----------------- |
| **Method**        | `POST`            |
| **Path**          | `/products`       |
| **Auth Required** | ✅ JWT (Any Role) |

#### Request (Simple Product)

```http
POST /products HTTP/1.1
Host: localhost:3102
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

```json
{
  "name": "Premium T-Shirt",
  "price": 2999,
  "stock": 100
}
```

#### Request (Variable Product)

Creates a product with attributes (Size, Color) and variants (SKUs).

```json
{
  "name": "Premium T-Shirt",
  "price": 2999,
  "attributes": [
    {
      "name": "Color",
      "values": ["Red", "Blue"],
      "displayOrder": 1
    },
    {
      "name": "Size",
      "values": ["S", "M", "L"],
      "displayOrder": 2
    }
  ],
  "variants": [
    {
      "sku": "TSHIRT-RED-S",
      "price": 2999,
      "stock": 10,
      "attributeValues": {
        "Color": "Red",
        "Size": "S"
      }
    },
    {
      "sku": "TSHIRT-BLUE-M",
      "price": 3499,
      "stock": 5,
      "attributeValues": {
        "Color": "Blue",
        "Size": "M"
      }
    }
  ]
}
```

**Fields:**

| Field        | Type        | Required | Description                                              |
| ------------ | ----------- | -------- | -------------------------------------------------------- |
| `name`       | string      | ✅ Yes   | Product name (1-255 characters)                          |
| `price`      | number      | ✅ Yes   | Base price in cents (positive integer)                   |
| `stock`      | number      | ❌ No    | Initial stock (default: 0). Ignored if variants present. |
| `attributes` | Attribute[] | ❌ No    | List of product attributes (Required for variants)       |
| `variants`   | Variant[]   | ❌ No    | List of product variants (SKUs)                          |

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Premium T-Shirt",
    "price": 2999,
    "ownerId": "550e8400-e29b-41d4-a716-446655440000",
    "stock": 15,
    "hasVariant": true,
    "createdAt": "2026-02-21T10:00:00.000Z",
    "updatedAt": "2026-02-21T10:00:00.000Z",
    "attributes": [
      {
        "id": "880e...",
        "name": "Color",
        "values": ["Red", "Blue"]
      }
    ],
    "variants": [
      {
        "id": "990e...",
        "sku": "TSHIRT-RED-S",
        "price": 2999,
        "stockQuantity": 10
      }
    ]
  }
}
```

#### Error Responses

| Code  | Error Code              | Description              |
| ----- | ----------------------- | ------------------------ |
| `400` | `PRODUCT_CREATE_FAILED` | Validation error         |
| `401` | `UNAUTHORIZED`          | Invalid or missing token |

---

### 4. Get Products

Retrieves products with filtering and pagination.

| Attribute         | Value             |
| ----------------- | ----------------- |
| **Method**        | `GET`             |
| **Path**          | `/products`       |
| **Auth Required** | ✅ JWT (Any Role) |

#### Request

```http
GET /products?page=1&limit=10&search=shirt&includeVariants=true HTTP/1.1
Host: localhost:3102
Authorization: Bearer <jwt-token>
```

**Query Parameters:**

| Parameter         | Type    | Default | Description                     |
| ----------------- | ------- | ------- | ------------------------------- |
| `page`            | number  | `1`     | Page number                     |
| `limit`           | number  | `10`    | Items per page                  |
| `search`          | string  | `null`  | Search by product name          |
| `minPrice`        | number  | `null`  | Minimum price filter (cents)    |
| `maxPrice`        | number  | `null`  | Maximum price filter (cents)    |
| `hasVariant`      | boolean | `null`  | Filter by variable products     |
| `inStock`         | boolean | `false` | Filter by stock availability    |
| `includeVariants` | boolean | `false` | Include attributes & variants   |
| `includeDeleted`  | boolean | `false` | Include soft-deleted products   |
| `onlyDeleted`     | boolean | `false` | Only show soft-deleted products |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "name": "Premium T-Shirt",
      "price": 2999,
      "ownerId": "550e8400-e29b-41d4-a716-446655440000",
      "stock": 100,
      "hasVariant": true,
      "createdAt": "2026-02-21T10:00:00.000Z",
      "updatedAt": "2026-02-21T10:00:00.000Z",
      "deletedAt": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "count": 1,
    "search": "shirt"
  }
}
```

---

### 5. Get Product by ID

Retrieves a specific product.

| Attribute         | Value             |
| ----------------- | ----------------- |
| **Method**        | `GET`             |
| **Path**          | `/products/:id`   |
| **Auth Required** | ✅ JWT (Any Role) |

#### Request

```http
GET /products/770e8400-e29b-41d4-a716-446655440000?includeDeleted=false HTTP/1.1
Host: localhost:3102
Authorization: Bearer <jwt-token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Product fetched successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Premium T-Shirt",
    "price": 2999,
    "ownerId": "550e8400-e29b-41d4-a716-446655440000",
    "stock": 100,
    "hasVariant": true,
    "attributes": [
      {
        "id": "attr-1",
        "name": "Size",
        "values": ["S", "M", "L"],
        "displayOrder": 1
      }
    ],
    "variants": [
      {
        "id": "var-1",
        "sku": "TSHIRT-S",
        "price": 2999,
        "stockQuantity": 50,
        "attributeValues": { "Size": "S" }
      }
    ],
    "createdAt": "2026-02-21T10:00:00.000Z",
    "updatedAt": "2026-02-21T10:00:00.000Z"
  }
}
```

---

### 6. Update Product

Updates an existing product. Can also update attributes and variants (full replacement).

| Attribute         | Value             |
| ----------------- | ----------------- |
| **Method**        | `PATCH`           |
| **Path**          | `/products/:id`   |
| **Auth Required** | ✅ JWT (Any Role) |

#### Request

```http
PATCH /products/770e8400-e29b-41d4-a716-446655440000 HTTP/1.1
Host: localhost:3102
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

```json
{
  "name": "Premium T-Shirt V2",
  "price": 3499,
  "variants": [
    {
      "sku": "TSHIRT-S",
      "price": 3499,
      "stock": 45,
      "attributeValues": { "Size": "S" }
    }
  ]
}
```

> **Note:** If `variants` or `attributes` arrays are provided, they **replace** the existing lists entirely.

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "name": "Premium T-Shirt V2",
    "updatedAt": "2026-02-21T10:05:00.000Z"
  }
}
```

---

### 7. Delete Product

Deletes a product (soft delete by default).

| Attribute         | Value             |
| ----------------- | ----------------- |
| **Method**        | `DELETE`          |
| **Path**          | `/products/:id`   |
| **Auth Required** | ✅ JWT (Any Role) |

#### Request

```http
DELETE /products/770e8400-e29b-41d4-a716-446655440000?force=false HTTP/1.1
```

---

### 8. Restore Product

Restores a soft-deleted product.

| Attribute         | Value                   |
| ----------------- | ----------------------- |
| **Method**        | `POST`                  |
| **Path**          | `/products/:id/restore` |
| **Auth Required** | ✅ JWT (Any Role)       |

---

### 9. Search Products

Alternative endpoint for product search.

| Attribute         | Value              |
| ----------------- | ------------------ |
| **Method**        | `GET`              |
| **Path**          | `/products/search` |
| **Auth Required** | ✅ JWT (Any Role)  |

#### Request

```http
GET /products/search?q=t-shirt&includeDeleted=false HTTP/1.1
```

---

## Data Models

### Product

```typescript
interface Product {
  id: string; // UUID
  name: string; // 1-255 characters
  price: number; // Price in cents
  ownerId: string; // Owner UUID
  stock: number; // Current stock quantity
  hasVariant: boolean; // Has product variants
  attributes?: ProductAttribute[]; // Optional list of attributes
  variants?: ProductVariant[]; // Optional list of variants
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

### ProductVariant

```typescript
interface ProductVariant {
  id: string; // UUID
  productId: string;
  sku: string; // Unique SKU
  price: number; // Variant price in cents
  stockQuantity: number;
  isActive: boolean;
  attributeValues: {
    [key: string]: string; // e.g., { Color: "Red", Size: "L" }
  };
}
```

### ProductAttribute

```typescript
interface ProductAttribute {
  id: string; // UUID
  productId: string;
  name: string; // e.g., "Color"
  values: string[]; // e.g., ["Red", "Blue"]
  displayOrder: number;
}
```

### CreateProductRequest

```typescript
interface CreateProductRequest {
  name: string;
  price: number;
  stock?: number;
  attributes?: {
    name: string;
    values: string[];
    displayOrder?: number;
  }[];
  variants?: {
    sku: string;
    price?: number;
    stock?: number;
    isActive?: boolean;
    attributeValues: Record<string, string>;
  }[];
}
```

---

**Last Updated:** 2026-02-21
**Documentation Version:** 1.1.0
