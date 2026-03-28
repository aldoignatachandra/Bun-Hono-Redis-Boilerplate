# Auth Service API Documentation

> **Service Name:** Auth Service
>
> **Version:** 1.0.0
>
> **Base URL:** `http://localhost:3100`
>
> **Port:** 3100

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Error Codes](#error-codes)
- [Data Models](#data-models)
- [Examples](#examples)

---

## Overview

The Auth Service is responsible for:

- **User Authentication**: Login/logout operations
- **Session Management**: JWT token issuance and validation
- **Security**: Single active session policy per user
- **Gateway Info**: Service discovery for downstream services

### Key Features

| Feature              | Description                             |
| -------------------- | --------------------------------------- |
| **JWT Tokens**       | Stateful tokens with session validation |
| **Single Session**   | Only one active session per user        |
| **Basic Auth**       | User credentials for login              |
| **System Auth**      | Service-to-service authentication       |
| **Activity Logging** | Login/logout events logged via Redis Streams |

---

## Authentication

### 1. User Authentication (Basic Auth)

Used for login endpoint.

**Header Format:**

```
Authorization: Basic <base64(email:password)>
```

**Example:**

```bash
# Email: user@example.com
# Password: Password123!
echo -n "user@example.com:Password123!" | base64
# Output: dXNlckBleGFtcGxlLmNvbT1QYXNzd29yZDEyMyE=
```

**cURL:**

```bash
curl -X POST http://localhost:3100/auth/login \
  -H "Authorization: Basic dXNlckBleGFtcGxlLmNvbT1QYXNzd29yZDEyMyE="
```

### 2. Token Authentication (JWT)

Used for protected endpoints after login.

**Header Format:**

```
Authorization: Bearer <jwt-token>
```

**Example:**

```bash
curl -X POST http://localhost:3100/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 3. System Authentication (Basic Auth)

Used for admin endpoints and service-to-service communication.

**Header Format:**

```
Authorization: Basic <base64(SYSTEM_USER:SYSTEM_PASS)>
```

**Environment Variables:**

```bash
SYSTEM_USER=admin
SYSTEM_PASS=admin123
```

**cURL:**

```bash
curl http://localhost:3100/admin/health \
  -u admin:admin123
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
| **Rate Limited**  | ❌ No     |

#### Request

```http
GET /health HTTP/1.1
Host: localhost:3100
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "service": "auth-service",
    "environment": "development",
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
| **Rate Limited**  | ❌ No           |

#### Request

```http
GET /admin/health HTTP/1.1
Host: localhost:3100
Authorization: Basic YWRtaW46YWRtaW4xMjM=
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Admin health check passed",
  "data": {
    "service": "auth-service",
    "mode": "admin",
    "config": {
      "db": "connected",
      "redis": "connected"
    },
    "timestamp": "2026-02-21T10:00:00.000Z"
  }
}
```

#### Error Responses

| Code  | Description                                             |
| ----- | ------------------------------------------------------- |
| `401` | Missing or invalid Authorization header                 |
| `500` | Auth misconfiguration (SYSTEM_USER/SYSTEM_PASS not set) |

**Middleware Error Shape (System Auth):**

```json
{
  "message": "Unauthorized: Invalid credentials"
}
```

---

### 3. Login

Authenticates a user and creates a new session.

> **Important:** This endpoint enforces a **Single Active Session** policy. Logging in will invalidate all previous sessions for the user.

| Attribute         | Value                      |
| ----------------- | -------------------------- |
| **Method**        | `POST`                     |
| **Path**          | `/auth/login`              |
| **Auth Required** | ✅ User Basic Auth         |
| **Rate Limited**  | ✅ Yes (10 requests / 60s) |

#### Request

**Headers:**

```http
POST /auth/login HTTP/1.1
Host: localhost:3100
Authorization: Basic <base64(email:password)>
Content-Type: application/json
```

**Body:** Empty (credentials must be in Authorization header)

```json
{}
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsImp0aSI6IjEyMzQ1Njc4LTkwYWItY2RlZi0xMjM0LTU2NzkwYWJjZGVmIiwiaWF0IjoxNzA4NDQ4MDAwLCJleHAiOjE3MDg0NTE2MDB9.signature",
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

#### Error Responses

| Code  | Error Code            | Description                        |
| ----- | --------------------- | ---------------------------------- |
| `401` | `UNAUTHORIZED`        | Missing Authorization header       |
| `401` | `INVALID_CREDENTIALS` | Invalid email/username or password |
| `401` | `INVALID_FORMAT`      | Invalid Basic Auth format          |
| `500` | `LOGIN_FAILED`        | Internal server error              |

**Middleware Error Shape (Basic Auth):**

```json
{
  "message": "Unauthorized: Missing or invalid Authorization header (Basic Auth required)"
}
```

#### cURL Example

```bash
# Using email
curl -X POST http://localhost:3100/auth/login \
  -H "Authorization: Basic $(echo -n 'user@example.com:Password123!' | base64)"

# Using username
curl -X POST http://localhost:3100/auth/login \
  -H "Authorization: Basic $(echo -n 'johndoe:Password123!' | base64)"
```

---

### 4. Logout

Invalidates the current user session.

| Attribute         | Value                      |
| ----------------- | -------------------------- |
| **Method**        | `POST`                     |
| **Path**          | `/auth/logout`             |
| **Auth Required** | ✅ JWT Token               |
| **Rate Limited**  | ✅ Yes (30 requests / 60s) |

#### Request

**Headers:**

```http
POST /auth/logout HTTP/1.1
Host: localhost:3100
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Optional Headers** (for activity logging):

```
X-Forwarded-For: 203.0.113.1
User-Agent: Mozilla/5.0...
X-Device-Type: mobile
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null
}
```

#### Error Responses

| Code  | Error Code        | Description                  |
| ----- | ----------------- | ---------------------------- |
| `401` | `UNAUTHORIZED`    | Missing Authorization header |
| `401` | `INVALID_TOKEN`   | Invalid token format         |
| `401` | `SESSION_INVALID` | Session invalid or expired   |
| `401` | `INVALID_SESSION` | Session ID missing in token  |
| `500` | `LOGOUT_FAILED`   | Internal server error        |

**Middleware Error Shape (JWT Auth):**

```json
{
  "message": "Unauthorized: Invalid token"
}
```

#### cURL Example

```bash
curl -X POST http://localhost:3100/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### 5. Gateway Information

Returns information about available downstream services.

| Attribute         | Value |
| ----------------- | ----- |
| **Method**        | `GET` |
| **Path**          | `/`   |
| **Auth Required** | ❌ No |
| **Rate Limited**  | ❌ No |

#### Request

```http
GET / HTTP/1.1
Host: localhost:3100
```

#### Response (200 OK)

```json
{
  "message": "Auth Service Gateway",
  "services": {
    "user": "http://localhost:3101",
    "product": "http://localhost:3102"
  }
}
```

---

### 6. OpenAPI Documentation

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

## Error Codes

| Error Code            | HTTP Status | Description                       |
| --------------------- | ----------- | --------------------------------- |
| `UNAUTHORIZED`        | 401         | Authentication required           |
| `INVALID_CREDENTIALS` | 401         | Wrong email/username or password  |
| `INVALID_TOKEN`       | 401         | Malformed or invalid JWT          |
| `SESSION_INVALID`     | 401         | Session does not exist or expired |
| `INVALID_SESSION`     | 401         | Session ID missing in token       |
| `SERVICE_UNHEALTHY`   | 503         | Service health check failed       |
| `LOGIN_FAILED`        | 500         | Login operation failed            |
| `LOGOUT_FAILED`       | 500         | Logout operation failed           |

---

## Data Models

### LoginResponse

```typescript
interface LoginResponse {
  success: true;
  message: string;
  data: {
    token: string; // JWT token
    user: {
      id: string; // UUID
      email: string; // User email
      username: string; // Username
      name: string | null;
      role: "ADMIN" | "USER";
    };
  };
}
```

### LogoutResponse

```typescript
interface LogoutResponse {
  success: true;
  message: string;
  data: null;
}
```

### GatewayInfo

```typescript
interface GatewayInfo {
  message: string;
  services: {
    user: string; // User service URL
    product: string; // Product service URL
  };
}
```

### ErrorResponse

```typescript
interface ErrorResponse {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
}
```

---

## JWT Token Structure

```typescript
interface JWTPayload {
  sub: string; // User ID (UUID)
  email: string; // User email
  role: "ADMIN" | "USER";
  jti: string; // Session ID (UUID)
  iat: number; // Issued at (Unix timestamp)
  exp: number; // Expires at (Unix timestamp)
}
```

**Token Example:**

```
Header: {"alg":"HS256","typ":"JWT"}
Payload: {"sub":"550e8400-...","email":"user@example.com","role":"USER","jti":"12345678-...","iat":1708448000,"exp":1708451600}
Signature: <HMAC-SHA256 signature>
```

---

## Session Management

### Single Active Session Policy

When a user logs in:

1. All existing sessions for that user are invalidated
2. A new session is created
3. A new JWT token is issued

This ensures:

- Users can only be logged in from one device at a time
- Previous tokens become invalid immediately upon new login

### Session Lifecycle

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Login  │───▶│ Create  │───▶│  Valid  │───▶│ Logout  │
│         │    │ Session │    │  Token  │    │         │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
                   │                                │
                   │                                ▼
                   │                         Invalidate
                   │                            Session
                   ▼
              Invalidate
           Previous Sessions
```

---

## Security Considerations

1. **Token Storage**: Store JWT tokens securely (httpOnly cookies recommended for web)
2. **HTTPS**: Always use HTTPS in production
3. **Token Expiration**: Tokens expire after 1 day (configurable)
4. **Session Validation**: Each request validates session exists in database
5. **Credential Security**: Never log passwords or tokens

---

## TypeScript Types

```typescript
// src/modules/auth/domain/types.ts

export interface LoginRequest {
  // Credentials in Basic Auth header, not in body
}

export interface LoginSuccessResponse {
  token: string;
  user: {
    id: string;
    email: string;
    username: string;
    name: string | null;
    role: "ADMIN" | "USER";
  };
}

export interface JWTPayload {
  sub: string;
  email: string;
  role: "ADMIN" | "USER";
  jti: string;
  iat: number;
  exp: number;
}
```

---

## OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: Auth Service API
  version: 1.0.0
  description: Authentication and session management service

servers:
  - url: http://localhost:3100
    description: Development server

paths:
  /health:
    get:
      summary: Health check
      tags: [Health]
      responses:
        "200":
          description: Service is healthy

  /auth/login:
    post:
      summary: Login user
      tags: [Authentication]
      security:
        - BasicAuth: []
      responses:
        "200":
          description: Login successful
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/LoginResponse"

  /auth/logout:
    post:
      summary: Logout user
      tags: [Authentication]
      security:
        - BearerAuth: []
      responses:
        "200":
          description: Logout successful

components:
  securitySchemes:
    BasicAuth:
      type: http
      scheme: basic
    BearerAuth:
      type: http
      scheme: bearer
```

---

**Last Updated:** 2026-02-22
**Documentation Version:** 1.0.1
