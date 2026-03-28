# User Service API Documentation

> **Service Name:** User Service
>
> **Version:** 1.0.0
>
> **Base URL:** `http://localhost:3101`
>
> **Port:** 3101

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Error Codes](#error-codes)
- [Data Models](#data-models)
- [Validation Rules](#validation-rules)
- [Examples](#examples)

---

## Overview

The User Service is responsible for:

- **User Management**: CRUD operations for user accounts
- **Profile Management**: User profile data
- **Admin Operations**: Administrative user management
- **Internal API**: Service-to-service user queries
- **Activity Logging**: User activity tracking

### Key Features

| Feature               | Description                            |
| --------------------- | -------------------------------------- |
| **Soft Delete**       | Users can be soft-deleted and restored |
| **Role-Based Access** | ADMIN and USER roles                   |
| **Activity Logging**  | Track user operations                  |
| **Internal API**      | Service-to-service endpoints           |
| **Paranoid Mode**     | Configurable soft-delete behavior      |

---

## Authentication

### 1. JWT Authentication

Required for all protected endpoints.

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

### 2. Role-Based Authorization

Some endpoints require specific roles:

| Role    | Access Level                                            |
| ------- | ------------------------------------------------------- |
| `ADMIN` | Full access to all endpoints including admin operations |
| `USER`  | Limited to own profile ( `/me` endpoint)                |

**Middleware Error Shape (Role Check):**

```json
{
  "message": "Forbidden: Insufficient permissions"
}
```

### 3. System Authentication

Required for internal API endpoints.

**Header Format:**

```
Authorization: Basic <base64(SYSTEM_USER:SYSTEM_PASS)>
```

**Environment Variables:**

```bash
SYSTEM_USER=admin
SYSTEM_PASS=admin123
```

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
Host: localhost:3101
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "service": "user-service",
    "environment": "development",
    "database": "connected",
    "timestamp": "2026-02-21T10:00:00.000Z"
  }
}
```

#### Error Response (503 Service Unhealthy)

```json
{
  "success": false,
  "message": "Service is unhealthy",
  "error": {
    "code": "SERVICE_UNHEALTHY",
    "details": {
      "service": "user-service",
      "database": "disconnected"
    }
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
Host: localhost:3101
Authorization: Basic YWRtaW46YWRtaW4xMjM=
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Admin health check passed",
  "data": {
    "service": "user-service",
    "mode": "admin",
    "config": {
      "db": "connected",
      "redis": "connected"
    },
    "timestamp": "2026-02-21T10:00:00.000Z"
  }
}
```

---

### 3. OpenAPI Documentation

Interactive and machine-readable API docs.

| Attribute         | Value           |
| ----------------- | --------------- |
| **Method**        | `GET`           |
| **Path**          | `/docs`         |
| **Auth Required** | ❌ No           |
| **Returns**       | Swagger UI HTML |

| Attribute         | Value                 |
| ----------------- | --------------------- |
| **Method**        | `GET`                 |
| **Path**          | `/docs/openapi.json`  |
| **Auth Required** | ❌ No                 |
| **Returns**       | OpenAPI JSON document |

---

### 4. Get Current User (Me)

Returns the profile of the authenticated user.

| Attribute         | Value                       |
| ----------------- | --------------------------- |
| **Method**        | `GET`                       |
| **Path**          | `/me`                       |
| **Auth Required** | ✅ JWT (Any Role)           |
| **Rate Limited**  | ✅ Yes (120 requests / 60s) |

#### Request

```http
GET /me HTTP/1.1
Host: localhost:3101
Authorization: Bearer <jwt-token>
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "User info fetched successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "johndoe",
    "name": "John Doe",
    "role": "USER"
  }
}
```

#### Error Responses

| Code  | Error Code       | Description              |
| ----- | ---------------- | ------------------------ |
| `401` | `UNAUTHORIZED`   | Invalid or missing token |
| `404` | `USER_NOT_FOUND` | User not found           |

**Middleware Error Shape (JWT Auth):**

```json
{
  "message": "Unauthorized: Invalid token"
}
```

---

### 5. Create User (Admin Only)

Creates a new user account.

| Attribute         | Value                      |
| ----------------- | -------------------------- |
| **Method**        | `POST`                     |
| **Path**          | `/admin/users`             |
| **Auth Required** | ✅ JWT + ADMIN Role        |
| **Rate Limited**  | ✅ Yes (10 requests / 60s) |

#### Request

```http
POST /admin/users HTTP/1.1
Host: localhost:3101
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "username": "newuser",
  "password": "Password123!",
  "role": "USER",
  "name": "New User Name"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "email": "newuser@example.com",
    "role": "USER",
    "createdAt": "2026-02-21T10:00:00.000Z"
  }
}
```

#### Error Responses

| Code  | Error Code           | Description                          |
| ----- | -------------------- | ------------------------------------ |
| `400` | `USER_CREATE_FAILED` | Validation error                     |
| `401` | `UNAUTHORIZED`       | Invalid or missing token             |
| `403` | `FORBIDDEN`          | Insufficient permissions (not ADMIN) |

#### cURL Example

```bash
curl -X POST http://localhost:3101/admin/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "username": "newuser",
    "password": "Password123!",
    "role": "USER",
    "name": "New User Name"
  }'
```

---

### 6. Get All Users (Admin Only)

Retrieves a paginated list of users.

| Attribute         | Value                       |
| ----------------- | --------------------------- |
| **Method**        | `GET`                       |
| **Path**          | `/admin/users`              |
| **Auth Required** | ✅ JWT + ADMIN Role         |
| **Rate Limited**  | ✅ Yes (120 requests / 60s) |

#### Request

```http
GET /admin/users?page=1&limit=10&includeDeleted=false&search=john HTTP/1.1
Host: localhost:3101
Authorization: Bearer <admin-jwt-token>
```

**Query Parameters:**

| Parameter        | Type    | Default | Description                                                       |
| ---------------- | ------- | ------- | ----------------------------------------------------------------- |
| `page`           | number  | `1`     | Page number                                                       |
| `limit`          | number  | `10`    | Items per page                                                    |
| `includeDeleted` | boolean | `false` | Include soft-deleted users                                        |
| `search`         | string  | -       | Filter by `email`, `username`, or `name` (case-insensitive ILIKE) |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Users fetched successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "username": "johndoe",
      "name": "John Doe",
      "role": "USER",
      "createdAt": "2026-02-21T10:00:00.000Z",
      "updatedAt": "2026-02-21T10:00:00.000Z",
      "deletedAt": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false,
    "search": "john"
  }
}
```

---

### 7. Get User by ID (Admin Only)

Retrieves a specific user's details.

| Attribute         | Value               |
| ----------------- | ------------------- |
| **Method**        | `GET`               |
| **Path**          | `/admin/users/:id`  |
| **Auth Required** | ✅ JWT + ADMIN Role |

#### Request

```http
GET /admin/users/550e8400-e29b-41d4-a716-446655440000?includeDeleted=false HTTP/1.1
Host: localhost:3101
Authorization: Bearer <admin-jwt-token>
```

**Path Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | User ID     |

**Query Parameters:**

| Parameter        | Type    | Default | Description                |
| ---------------- | ------- | ------- | -------------------------- |
| `includeDeleted` | boolean | `false` | Include soft-deleted users |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "johndoe",
    "name": "John Doe",
    "role": "USER",
    "createdAt": "2026-02-21T10:00:00.000Z",
    "updatedAt": "2026-02-21T10:00:00.000Z",
    "deletedAt": null
  }
}
```

#### Error Responses

| Code  | Error Code       | Description    |
| ----- | ---------------- | -------------- |
| `404` | `USER_NOT_FOUND` | User not found |

---

### 8. Delete User (Admin Only)

Deletes a user (soft delete by default).

> **Safety Checks:**
>
> - Cannot delete yourself.
> - Cannot delete other admins.
> - Cannot soft-delete an already deleted user.

| Attribute         | Value                     |
| ----------------- | ------------------------- |
| **Method**        | `DELETE`                  |
| **Path**          | `/admin/users/:id`        |
| **Auth Required** | ✅ JWT + ADMIN Role       |
| **Rate Limited**  | ✅ Yes (5 requests / 60s) |

#### Request

```http
DELETE /admin/users/550e8400-e29b-41d4-a716-446655440000?force=false HTTP/1.1
Host: localhost:3101
Authorization: Bearer <admin-jwt-token>
```

**Path Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | User ID     |

**Query Parameters:**

| Parameter | Type    | Default | Description                      |
| --------- | ------- | ------- | -------------------------------- |
| `force`   | boolean | `false` | Permanent deletion (hard delete) |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "User soft deleted",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "force": false
  }
}
```

#### Error Responses

| Code  | Error Code              | Description                                       |
| ----- | ----------------------- | ------------------------------------------------- |
| `400` | `USER_ALREADY_DELETED`  | User is already soft-deleted (when `force=false`) |
| `403` | `USER_DELETE_FORBIDDEN` | Cannot delete self or other admins                |
| `404` | `USER_NOT_FOUND`        | User not found                                    |
| `500` | `USER_DELETE_FAILED`    | Deletion failed                                   |

---

### 9. Restore User (Admin Only)

Restores a soft-deleted user.

> **Idempotency:**
>
> - Returns error if user is already active.

| Attribute         | Value                      |
| ----------------- | -------------------------- |
| **Method**        | `POST`                     |
| **Path**          | `/admin/users/:id/restore` |
| **Auth Required** | ✅ JWT + ADMIN Role        |

#### Request

```http
POST /admin/users/550e8400-e29b-41d4-a716-446655440000/restore HTTP/1.1
Host: localhost:3101
Authorization: Bearer <admin-jwt-token>
```

**Path Parameters:**

| Parameter | Type          | Description |
| --------- | ------------- | ----------- |
| `id`      | string (UUID) | User ID     |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "User restored successfully",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "username": "johndoe",
      "name": "John Doe",
      "role": "USER",
      "createdAt": "2026-02-21T10:00:00.000Z",
      "updatedAt": "2026-02-21T10:01:00.000Z"
    }
  }
}
```

#### Error Responses

| Code  | Error Code            | Description            |
| ----- | --------------------- | ---------------------- |
| `400` | `USER_ALREADY_ACTIVE` | User is already active |
| `404` | `USER_NOT_FOUND`      | User not found         |
| `500` | `USER_RESTORE_FAILED` | Restoration failed     |

---

### 10. Get Oldest User (Internal API)

Returns the oldest active user by role. Used for service-to-service communication (e.g., product seeder).

| Attribute         | Value                        |
| ----------------- | ---------------------------- |
| **Method**        | `GET`                        |
| **Path**          | `/api/internal/users/oldest` |
| **Auth Required** | ✅ System Auth               |

#### Request

```http
GET /api/internal/users/oldest?role=USER HTTP/1.1
Host: localhost:3101
Authorization: Basic YWRtaW46YWRtaW4xMjM=
```

**Query Parameters:**

| Parameter | Type   | Default  | Description                            |
| --------- | ------ | -------- | -------------------------------------- |
| `role`    | string | `'USER'` | Filter by role (`'ADMIN'` \| `'USER'`) |

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Oldest USER user retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "johndoe",
    "name": "John Doe",
    "role": "USER",
    "createdAt": "2026-02-21T10:00:00.000Z"
  }
}
```

#### Error Responses

| Code  | Error Code                 | Description                     |
| ----- | -------------------------- | ------------------------------- |
| `400` | `INVALID_ROLE`             | Invalid role parameter          |
| `401` | `UNAUTHORIZED`             | Invalid system credentials      |
| `404` | `USER_NOT_FOUND`           | No user found matching criteria |
| `500` | `FETCH_OLDEST_USER_FAILED` | Internal server error           |

**Middleware Error Shape (System Auth):**

```json
{
  "message": "Unauthorized: Invalid credentials"
}
```

#### cURL Example

```bash
curl http://localhost:3101/api/internal/users/oldest?role=USER \
  -u admin:admin123
```

---

## Error Codes

| Error Code                 | HTTP Status | Description                       |
| -------------------------- | ----------- | --------------------------------- |
| `UNAUTHORIZED`             | 401         | Authentication required           |
| `FORBIDDEN`                | 403         | Insufficient permissions          |
| `USER_NOT_FOUND`           | 404         | User does not exist               |
| `INVALID_ROLE`             | 400         | Invalid role parameter            |
| `USER_CREATE_FAILED`       | 400         | User creation validation failed   |
| `USER_FETCH_FAILED`        | 500         | Failed to fetch users             |
| `USER_DELETE_FAILED`       | 500         | User deletion failed              |
| `USER_RESTORE_FAILED`      | 500         | User restoration failed           |
| `FETCH_OLDEST_USER_FAILED` | 500         | Failed to fetch oldest user       |
| `USER_ALREADY_DELETED`     | 400         | User already soft-deleted         |
| `USER_DELETE_FORBIDDEN`    | 403         | Cannot delete self or other admin |
| `USER_ALREADY_ACTIVE`      | 400         | User already active (restoration) |

---

## Data Models

### User

```typescript
interface User {
  id: string; // UUID
  email: string; // Unique, valid email
  username: string; // Unique, 3-50 chars
  name: string | null; // Optional display name
  role: "ADMIN" | "USER";
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date; // Soft delete timestamp
}
```

### UserResponse

```typescript
interface UserResponse {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: "ADMIN" | "USER";
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
```

### CreateUserRequest

```typescript
interface CreateUserRequest {
  email: string; // Required, valid email
  username: string; // Required, 3-50 chars
  password: string; // Required, see validation rules
  role?: "ADMIN" | "USER"; // Optional, default: 'USER'
  name?: string; // Optional, max 255 chars
}
```

### InternalOldestUserResponse

```typescript
interface InternalOldestUserResponse {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: "ADMIN" | "USER";
  createdAt: Date;
}
```

---

## Validation Rules

### Email

- **Format:** Valid email address
- **Unique:** Must be unique across all users
- **Required:** Yes (for user creation)

**Regex Pattern:**

```regex
/^[^\s@]+@[^\s@]+\.[^\s@]+$/
```

### Username

- **Minimum Length:** 3 characters
- **Maximum Length:** 50 characters
- **Allowed Characters:** Alphanumeric and underscore
- **Unique:** Must be unique across all users
- **Required:** Yes (for user creation)

**Regex Pattern:**

```regex
/^[a-zA-Z0-9_]{3,50}$/
```

### Password

- **Minimum Length:** 8 characters
- **Required Characters:**
  - At least 1 uppercase letter (`A-Z`)
  - At least 1 number (`0-9`)
- **Allowed Special Characters:** `!@#$%^&*()_+-=[]{}|;:,.<>?`
- **Forbidden Characters:** `'`, `"`, `` ` ``, `\`, `/` (injection prevention)

**Validation Pattern:**

```typescript
// Minimum 8 chars, 1 uppercase, 1 number
/^(?=.*[A-Z])(?=.*\d).{8,}$/

// Forbidden characters check
/['"` `\/]/
```

### Name

- **Maximum Length:** 255 characters
- **Required:** No

### Role

- **Allowed Values:** `'ADMIN'`, `'USER'`
- **Default:** `'USER'`
- **Case Sensitive:** Yes (uppercase)

---

## TypeScript Types

```typescript
// src/modules/user/domain/schema.ts

export type Role = "ADMIN" | "USER";

export interface User {
  id: string;
  email: string;
  username: string;
  name: string | null;
  password: string; // Hashed, never returned in API
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface UserResponse {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  role?: Role;
  name?: string;
}

export interface UpdateUserRequest {
  email?: string;
  username?: string;
  name?: string;
  password?: string;
  role?: Role;
}

export interface UserQueryOptions {
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
}
```

---

## Usage Examples

### Create User (Admin)

```typescript
const response = await fetch("http://localhost:3101/admin/users", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    email: "newuser@example.com",
    username: "newuser",
    password: "Password123!",
    role: "USER",
    name: "New User",
  }),
});

const { data } = await response.json();
console.log("Created user:", data.id);
```

### Get Current User

```typescript
const response = await fetch("http://localhost:3101/me", {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

const { data } = await response.json();
console.log("Current user:", data.email);
```

### Internal API: Get Oldest User

```typescript
const credentials = btoa("admin:admin123");

const response = await fetch(
  "http://localhost:3101/api/internal/users/oldest?role=USER",
  {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  },
);

const { data } = await response.json();
console.log("Oldest user ID:", data.id);
```

---

**Last Updated:** 2026-02-22
**Documentation Version:** 1.0.1
