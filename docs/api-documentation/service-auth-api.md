# Service Auth API Documentation

## Overview

The Authentication Service handles user authentication (login/logout) and provides gateway information. It manages user sessions and issues JWT tokens.

## Base URL

All endpoints are relative to the service base URL (default: `http://localhost:3100`).

## Response Format

All API responses follow a standardized format:

**Success:**

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "meta": { ... } // Optional metadata (pagination, etc.)
}
```

**Error:**

```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": ... // Optional error details
  }
}
```

---

## Endpoints

### 1. Health Check

Checks the operational status of the service.

- **URL:** `/health`
- **Method:** `GET`
- **Auth Required:** No
- **Success Response (200):**
  ```json
  {
    "success": true,
    "message": "Service is healthy",
    "data": {
      "service": "auth-service",
      "environment": "development",
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
      "service": "auth-service",
      "mode": "admin",
      "config": {
        "db": "connected",
        "kafka": "connected"
      },
      "timestamp": "2024-03-20T10:00:00.000Z"
    }
  }
  ```

### 3. Login

Authenticates a user and creates a new session.
**Note:** This endpoint enforces a "Single Active Session" policy. Logging in will invalidate any previous sessions for the user.

- **URL:** `/auth/login`
- **Method:** `POST`
- **Auth Required:** Basic Auth
  - **Header:** `Authorization: Basic <base64(identifier:password)>`
  - **Identifier:** Can be either **Email** or **Username**.
- **Request Body:** None (Empty JSON `{}` or no body)
  - _Note:_ Do not send credentials in the JSON body. They must be in the `Authorization` header.

**Example Request (cURL):**

```bash
# Identifier: user@example.com
# Password: Password123!
# base64("user@example.com:Password123!") = dXNlckBleGFtcGxlLmNvbT1QYXNzd29yZDEyMyE=

curl -X POST http://localhost:3100/auth/login \
  -H "Authorization: Basic dXNlckBleGFtcGxlLmNvbT1QYXNzd29yZDEyMyE="
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "username": "johndoe",
      "name": "John Doe",
      "role": "USER"
    }
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid credentials or missing Authorization header.
- `500 Internal Server Error`: Server processing error.

### 4. Logout

Invalidates the current user session.

- **URL:** `/auth/logout`
- **Method:** `POST`
- **Auth Required:** Yes (JWT Token)
  - **Header:** `Authorization: Bearer <token>`
- **Request Body:** None

**Example Request (cURL):**

```bash
curl -X POST http://localhost:3100/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR..."
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or expired token.
- `500 Internal Server Error`: Server processing error.

### 5. Gateway Info

Returns information about available downstream services.

- **URL:** `/`
- **Method:** `GET`
- **Auth Required:** No
- **Success Response (200):**
  ```json
  {
    "message": "Auth Service Gateway",
    "services": {
      "user": "http://localhost:3101",
      "product": "http://localhost:3102"
    }
  }
  ```
