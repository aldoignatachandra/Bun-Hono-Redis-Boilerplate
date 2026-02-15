# Service Product API Documentation

## Overview

The Product Service manages the lifecycle of products, including creation, retrieval, updating, deletion (soft & hard), and restoration.

## Base URL

All endpoints are relative to the service base URL (default: `http://localhost:3102`).

## Response Format

Standardized JSON response (see Service Auth docs for format).

## Authentication

All endpoints require a valid JWT token in the header:
`Authorization: Bearer <token>`

---

## Endpoints

### 1. Health Check

- **URL:** `/health`
- **Method:** `GET`
- **Auth Required:** No
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Service is healthy",
    "data": {
      "service": "product-service",
      "environment": "development",
      "database": "connected",
      "timestamp": "2024-03-20T10:00:00.000Z"
    }
  }
  ```

### 2. Admin Health Check

Detailed health check including database and Kafka connection status.

- **URL:** `/admin/health`
- **Method:** `GET`
- **Auth Required:** Yes (System Basic Auth via `SYSTEM_USER`/`SYSTEM_PASS` env vars)
- **Success Response (200):**
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
      "timestamp": "2024-03-20T10:00:00.000Z"
    }
  }
  ```

### 3. Create Product

Creates a new product.

- **URL:** `/products`
- **Method:** `POST`
- **Auth Required:** Yes
- **Request Body (JSON):**
  ```json
  {
    "name": "Product Name",       // Required. String. Max 255 chars.
    "price": 99.99                // Required. Number (Integer or Float). Must be positive.
  }
  ```
- **Success Response (201):**
  ```json
  {
    "success": true,
    "message": "Product created successfully",
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Product Name",
      "price": 99.99,
      "ownerId": "user-uuid-here",
      "createdAt": "2024-03-20T10:00:00.000Z"
    }
  }
  ```

### 4. Get All Products

Retrieves a paginated list of products.

- **URL:** `/products`
- **Method:** `GET`
- **Auth Required:** Yes
- **Query Parameters:**
  - `page`: Page number (default: `1`).
  - `limit`: Items per page (default: `10`).
  - `search`: Search term for product name.
  - `minPrice`: Filter by minimum price.
  - `maxPrice`: Filter by maximum price.
  - `includeDeleted`: `true` to include soft-deleted products (default: `false`).
  - `onlyDeleted`: `true` to return *only* soft-deleted products (default: `false`).

- **Example URL:** `/products?page=1&limit=20&minPrice=10&search=Phone`

- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Products fetched successfully",
    "data": [
      {
        "id": "...",
        "name": "Phone",
        "price": 599.99,
        "ownerId": "...",
        "createdAt": "..."
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "count": 1,
      "includeDeleted": false,
      "onlyDeleted": false,
      "search": "Phone",
      "priceRange": { "min": 10, "max": null }
    }
  }
  ```

### 5. Get Product by ID

Retrieves a specific product.

- **URL:** `/products/:id`
- **Method:** `GET`
- **Auth Required:** Yes
- **Query Parameters:**
  - `includeDeleted`: `true` to find even if soft-deleted.
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Product fetched successfully",
    "data": { ... }
  }
  ```

### 6. Update Product

Updates an existing product. Only the owner (or Admin) can perform this.

- **URL:** `/products/:id`
- **Method:** `PATCH`
- **Auth Required:** Yes
- **Request Body (JSON):** (All fields are optional, but at least one should be provided)
  ```json
  {
    "name": "New Name",     // Optional
    "price": 120.50         // Optional
  }
  ```
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Product updated successfully",
    "data": { ... }
  }
  ```

### 7. Delete Product

Deletes a product. Default is soft delete.

- **URL:** `/products/:id`
- **Method:** `DELETE`
- **Auth Required:** Yes (Owner or Admin)
- **Query Parameters:**
  - `force`: `true` for permanent deletion (hard delete). Default: `false`.
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Product soft deleted", // or "Product permanently deleted"
    "data": {
      "productId": "...",
      "force": false
    }
  }
  ```

### 8. Restore Product

Restores a soft-deleted product.

- **URL:** `/products/:id/restore`
- **Method:** `POST`
- **Auth Required:** Yes (Owner or Admin)
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Product restored successfully",
    "data": { "product": { ... } }
  }
  ```

### 9. Search Products (Specialized)

Alternative endpoint for searching products.

- **URL:** `/products/search`
- **Method:** `GET`
- **Auth Required:** Yes
- **Query Parameters:**
  - `q`: Search query (Required).
  - `includeDeleted`: `true` to include deleted.
  - `onlyDeleted`: `true` to only search deleted.
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Products fetched successfully",
    "data": [ ... ]
  }
  ```
