# Service User API Documentation

## Overview

The User Service handles user management (CRUD), profile retrieval, and administrative tasks. Most write operations are restricted to Admins.

## Base URL

All endpoints are relative to the service base URL (default: `http://localhost:3101`).

## Response Format

Standardized JSON response (see Service Auth docs for format).

## Authentication

All endpoints require a valid JWT token in the header:
`Authorization: Bearer <token>`

## Data Validation Rules

- **Email:** Must be a valid email format. Unique across the system.
- **Username:** Min 3 chars, Max 50 chars. Unique across the system.
- **Password:**
  - Min 8 characters.
  - At least 1 uppercase letter (`A-Z`).
  - At least 1 number (`0-9`).
  - Allowed special chars: `!@#$%^&*()_+-=[]{}|;:,.<>?`
  - Forbidden chars: `'`, `"`, `` ` ``, `\`, `/` (to prevent injection).

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
      "service": "user-service",
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
      "service": "user-service",
      "mode": "admin",
      "config": {
        "db": "connected",
        "kafka": "connected"
      },
      "timestamp": "2024-03-20T10:00:00.000Z"
    }
  }
  ```

### 3. Get Current User (Me)

Retrieves the profile of the currently authenticated user.

- **URL:** `/me`
- **Method:** `GET`
- **Auth Required:** Yes
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "User info fetched successfully",
    "data": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "USER"
    }
  }
  ```

### 4. Create User (Admin Only)

Creates a new user account.

- **URL:** `/admin/users`
- **Method:** `POST`
- **Auth Required:** Yes (Role: ADMIN)
- **Request Body (JSON):**
  ```json
  {
    "email": "newuser@example.com",  // Required. Valid email.
    "username": "newuser",           // Required. Min 3, Max 50.
    "password": "Password123!",      // Required. See validation rules.
    "role": "USER",                  // Optional. "ADMIN" or "USER". Default: "USER".
    "name": "New User Name"          // Optional. Max 255.
  }
  ```
- **Success Response (201):**
  ```json
  {
    "success": true,
    "message": "User created successfully",
    "data": {
      "id": "uuid",
      "email": "newuser@example.com",
      "role": "USER",
      "createdAt": "..."
    }
  }
  ```

### 5. Get All Users (Admin Only)

Retrieves a paginated list of users.

- **URL:** `/admin/users`
- **Method:** `GET`
- **Auth Required:** Yes (Role: ADMIN)
- **Query Parameters:**
  - `page`: Page number (default: `1`).
  - `limit`: Items per page (default: `10`).
  - `includeDeleted`: `true` to include soft-deleted users (default: `false`).
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Users fetched successfully",
    "data": [
      {
        "id": "uuid",
        "email": "...",
        "role": "USER",
        ...
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "count": 5
    }
  }
  ```

### 6. Get User by ID (Admin Only)

Retrieves a specific user's details.

- **URL:** `/admin/users/:id`
- **Method:** `GET`
- **Auth Required:** Yes (Role: ADMIN)
- **Query Parameters:**
  - `includeDeleted`: `true` to find even if soft-deleted.
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "User fetched successfully",
    "data": { ... }
  }
  ```

### 7. Delete User (Admin Only)

Deletes a user. Default is soft delete.

- **URL:** `/admin/users/:id`
- **Method:** `DELETE`
- **Auth Required:** Yes (Role: ADMIN)
- **Query Parameters:**
  - `force`: `true` for permanent deletion (hard delete). Default: `false`.
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "User soft deleted", // or "User permanently deleted"
    "data": {
      "userId": "...",
      "force": false
    }
  }
  ```

### 8. Restore User (Admin Only)

Restores a soft-deleted user.

- **URL:** `/admin/users/:id/restore`
- **Method:** `POST`
- **Auth Required:** Yes (Role: ADMIN)
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "User restored successfully",
    "data": { "user": { ... } }
  }
  ```
