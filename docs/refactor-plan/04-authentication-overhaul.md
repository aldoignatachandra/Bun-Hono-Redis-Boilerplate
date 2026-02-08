# Authentication System Overhaul Plan

## 🎯 Objective

Centralize authentication logic within `service-auth`, securing APIs with strict protocols (Basic Auth for credentials, JWT for sessions), and implement a **Single Active Session** policy backed by a database. This ensures tight security control, immediate revocation capabilities, and detailed session auditing.

## 🏗️ Architecture Overview

### 1. 🛡️ Service Auth (`service-auth`)

- **Role**: The **Sole Authority** for identity verification, token issuance, and session management.
- **Database Access**:
  - **User Model**: Read-only copy of `users` table for credential verification.
  - **UserSession Model**: **New** table to track active sessions (Owner).
- **Key Responsibilities**:
  - Validate User Credentials.
  - Manage User Sessions (Create, Invalidate).
  - Issue JSON Web Tokens (JWT) tied to a specific `sessionId`.
- **Security Protocol**:
  - **"Non-Naked" Login**: The `/login` endpoint strictly requires `Authorization: Basic <base64 email:password>`.
  - **Single Session Policy**:
    - **Login**: When a user logs in, **force delete (hard delete)** all existing sessions for that user to ensure only one active session exists, then create a new one.
    - **Logout**: Force delete the specific session.
  - **Session Metadata**: Store IP, User Agent, Device details, and creation time.
  - **Consistency**: All tables, including `user_sessions`, **MUST** have `createdAt`, `updatedAt`, and `deletedAt` columns, even if we use force deletes for sessions.

### 2. 👤 Service User (`service-user`)

- **Role**: Resource Server for User Management.
- **Auth Responsibility**:
  - **Remove** all token generation/login logic.
  - **Validate** incoming JWTs:
    - Verify signature (Shared Secret).
    - **Verify Session Validity**: Check if `jti` (Session ID) exists and is active in the `user_sessions` table (via direct DB check or inter-service call - _Decision: Direct DB check for speed/simplicity in this boilerplate_).

### 3. 📦 Service Product (`service-product`)

- **Role**: Resource Server for Product Management.
- **Auth Responsibility**:
  - **Validate** incoming JWTs (Signature + Session Validity).

---

## 🛠️ Implementation Plan

### Phase 1: Database Schema & Models (`service-auth`)

**Goal**: Create the foundation for session tracking.

1.  **New Model: `UserSession` (`user_sessions` table)**
    - `id` (UUID, Primary Key) - Maps to JWT `jti` claim.
    - `userId` (UUID, Foreign Key to `users.id`).
    - `token` (Text, Hash of the JWT signature - optional, but good for audit).
    - `ipAddress` (String).
    - `userAgent` (String).
    - `deviceType` (String, parsed from UA).
    - `expiresAt` (Timestamp).
    - **Timestamps**: `createdAt`, `updatedAt`, `deletedAt` (Standard consistency columns).

2.  **Replicate `User` Model**:
    - Copy `User` model definition to `service-auth` for read-only access.

### Phase 2: Service Auth Logic

**Goal**: Implement the "Single Session" Login Flow.

1.  **Login Endpoint (`POST /auth/login`)**:
    - **Input**: `Authorization: Basic ...` header.
    - **Process**:
      1.  Verify Credentials.
      2.  **Atomic Transaction**:
          - **Force Delete** all existing sessions for `userId` (Hard delete from DB).
          - Create new `UserSession` (capture IP/UA from request).
      3.  Generate JWT with `sub=userId` and `jti=sessionId`.
    - **Output**: `{ token, user }`.

2.  **Logout Endpoint (`POST /auth/logout`)**:
    - **Input**: `Authorization: Bearer <token>`.
    - **Process**: **Force Delete** the session corresponding to the token's `jti`.

### Phase 3: Middleware Standardization (All Services)

**Goal**: Enforce session validity across the platform.

1.  **Enhanced `auth.ts` Middleware**:
    - Step 1: Verify JWT Signature (Stateless).
    - Step 2: **Session Check** (Stateful):
      - Extract `jti` (Session ID) from token.
      - Query `user_sessions` table: Is ID present? (If deleted, access denied).
      - If missing -> `401 Unauthorized` (Force Re-login).

### Phase 4: Cleanup & Documentation

1.  **Service User Cleanup**: Remove legacy `login` routes.
2.  **Docs**: Update API docs with "Single Session" behavior explanation.

---

## 📋 Checklist for AI Pair Programmer

- [ ] **DB**: Create `UserSession` schema in `service-auth` with `deletedAt` column for consistency.
- [ ] **Service Auth**: Implement "Single Session" Login (Force Delete Old -> Create New).
- [ ] **Service Auth**: Implement Logout (Force Delete Session).
- [ ] **Middleware**: Update `auth.ts` to check `user_sessions` table for `jti` validity.
- [ ] **Testing**: Verify login invalidates previous tokens immediately.
