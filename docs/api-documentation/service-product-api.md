# Product Service API Documentation

> **Service Name:** Product Service
>
> **Version:** 1.0.0
>
> **Base URL:** http://localhost:3102
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

**Middleware Error Shape (JWT Auth):**

```json
{
  "message": "Unauthorized: Invalid token"
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

**Middleware Error Shape (System Auth):**

```json
{
  "message": "Forbidden: Invalid system credentials"
}
```

---

## Endpoints

### 1. Create Product

Create a new product, optionally with variants.

- **URL:** `/products`
- **Method:** `POST`
- **Auth:** Required (JWT)

**Request Body (Simple Product):**

```json
{
  "name": "T-Shirt",
  "description": "Cotton T-Shirt",
  "price": 29.99,
  "stock": 100
}
```

**Request Body (Variable Product):**

```json
{
  "name": "T-Shirt",
  "description": "Cotton T-Shirt",
  "price": 29.99,
  "variants": [
    {
      "sku": "TSHIRT-RED-S",
      "price": 29.99,
      "stock": 50,
      "attributes": {
        "Color": "Red",
        "Size": "S"
      }
    },
    {
      "sku": "TSHIRT-RED-M",
      "price": 31.99,
      "stock": 30,
      "attributes": {
        "Color": "Red",
        "Size": "M"
      }
    }
  ]
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "id": "p1",
    "name": "T-Shirt",
    "price": 29.99,
    "ownerId": "u1",
    "createdAt": "2024-03-20T10:00:00Z"
  }
}
```

### 2. Get Products

List products with pagination and filters.

- **URL:** `/products`
- **Method:** `GET`
- **Auth:** Optional (Public catalog)

**Query Parameters:**

| Param            | Type    | Description                               |
| ---------------- | ------- | ----------------------------------------- |
| `page`           | number  | Page number (default: 1)                  |
| `limit`          | number  | Items per page (default: 10)              |
| `search`         | string  | Search by name or description             |
| `minPrice`       | number  | Minimum price filter                      |
| `maxPrice`       | number  | Maximum price filter                      |
| `ownerId`        | string  | Filter by owner                           |
| `includeDeleted` | boolean | Include soft-deleted items (Admin/Owner)  |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Products fetched successfully",
  "data": [
    {
      "id": "p1",
      "name": "T-Shirt",
      "price": 29.99,
      "stock": 100,
      "ownerId": "u1"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

### 3. Get Product Details

Get a single product by ID.

- **URL:** `/products/:id`
- **Method:** `GET`
- **Auth:** Optional

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Product fetched successfully",
  "data": {
    "id": "p1",
    "name": "T-Shirt",
    "price": 29.99,
    "variants": [
      {
        "id": "v1",
        "sku": "TSHIRT-RED-S",
        "price": 29.99,
        "attributes": { "Color": "Red", "Size": "S" }
      }
    ]
  }
}
```

### 4. Update Product

Update product details or variants.

- **URL:** `/products/:id`
- **Method:** `PATCH`
- **Auth:** Required (Owner or Admin)

**Request Body:**

```json
{
  "price": 24.99,
  "stock": 150
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": { ... }
}
```

### 5. Delete Product

Soft delete a product.

- **URL:** `/products/:id`
- **Method:** `DELETE`
- **Auth:** Required (Owner or Admin)

**Query Parameters:**

| Param   | Type    | Description                                  |
| ------- | ------- | -------------------------------------------- |
| `force` | boolean | If true, permanently delete (Admin only)     |

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Product soft deleted",
  "data": { "id": "p1", "deletedAt": "..." }
}
```

### 6. Restore Product

Restore a soft-deleted product.

- **URL:** `/products/:id/restore`
- **Method:** `POST`
- **Auth:** Required (Owner or Admin)

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Product restored successfully"
}
```

---

## Error Codes

| Code                    | Status | Description                                |
| ----------------------- | ------ | ------------------------------------------ |
| `PRODUCT_NOT_FOUND`     | 404    | Product ID does not exist                  |
| `PRODUCT_UPDATE_FAILED` | 403    | User does not own the product              |
| `PRODUCT_CREATE_FAILED` | 400    | Validation error or bad input              |
| `PRODUCT_DELETE_FAILED` | 500    | Server error during deletion               |
| `INVALID_VARIANTS`      | 400    | Variant data is malformed                  |

---

## Data Models

### Product

```typescript
interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  variants?: ProductVariant[];
}
```

### Product Variant

```typescript
interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  price?: number;
  stock: number;
  attributes: Record<string, string>; // e.g., { "Color": "Red" }
}
```

---

## Marketplace Model

This service supports a **Marketplace** model where multiple users can create products.

- **Ownership**: Each product is linked to an `ownerId` (User ID from auth token).
- **Isolation**: Users can only update or delete products they own.
- **Admin Override**: Admins can manage any product regardless of ownership.
- **Public Catalog**: `GET` endpoints show all active products from all owners.

---

## Examples

### Search for Red T-Shirts under $50

```bash
curl "http://localhost:3102/products?search=T-Shirt&maxPrice=50"
```

### Admin: Force Delete a Product

```bash
curl -X DELETE "http://localhost:3102/products/p1?force=true" \
  -H "Authorization: Bearer <admin-token>"
```
