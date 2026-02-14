# Backend Best Practices & Technical Rules

This document outlines mandatory technical requirements for backend development. The AI model MUST check code against these rules before final output.

## 1. Database Interaction (ORM & Performance)

**Severity: Critical**

- **Mandatory ORM Usage**:
  - Use **Drizzle ORM** for all database interactions.
  - **Raw SQL** is prohibited unless:
    1. The query is too complex for Drizzle builders.
    2. Performance benchmarks prove the ORM is a bottleneck.
    - _Exception Requirement_: Must be commented with `// REASON: Raw SQL required for [reason]`.
- **Query Optimization**:
  - **N+1 Prevention**: Always use `with: { ... }` in Drizzle or explicit `.leftJoin()` rather than looping queries.
  - **Pagination**: All list endpoints MUST implement `limit` and `offset` (or cursor-based pagination).
  - **Select Specific Fields**: Avoid `select *` (or default selection) for large tables. Use `.select({ ... })` to fetch only needed columns.
  - **Indexes**: Ensure queried columns in `where` clauses are indexed. Suggest indexes if missing.

## 2. Code Modification Protocol

**Severity: Critical**

- **Cross-Function Impact Analysis**:
  - Before modifying an existing function signature or return type:
    1. **Search**: Find all usages of the function in the codebase.
    2. **Analyze**: Check if the change breaks call sites.
    3. **Refactor**: Update all dependent code or create a new version of the function (e.g., `v2` or `...Optimized`).
- **Backward Compatibility**:
  - If a change is breaking, consider adding an optional parameter instead of changing existing ones.

## 3. Commenting & Documentation Standards

**Severity: Medium**

- **Prohibited**:
  - ❌ Verbose AI-generated summaries (e.g., "This function takes A and returns B...").
  - ❌ Redundant comments (e.g., `const i = 0; // Set i to 0`).
- **Required**:
  - ✅ **"Why" over "What"**: Explain the _business logic_ or _complex decision_ behind the code.
  - ✅ **JSDoc**: Required for all _public_ interfaces, classes, and exported service methods.
  - ✅ **TODOs**: Must include context (e.g., `// TODO: Refactor when API v2 is live`).
- **Format**:
  - Keep comments concise and professional.

## 4. Error Handling

**Severity: High**

- **Structure**:
  - Use custom error classes (e.g., `NotFoundError`, `ValidationError`).
  - Do not expose raw database errors to the client.
- **Logging**:
  - Log errors with context (stack trace + input params) on the server side.

## 5. Authentication & Security

**Severity: Critical**

- **Basic Auth Usage**:
  - **User Login**: Use Database-backed validation (verify email/password hash). NEVER hardcode user credentials in `.env` for user login endpoints.
  - **System/Internal Auth**: Use Environment Variable-backed validation (`SYSTEM_USER`, `SYSTEM_PASS`) for protecting internal admin/metric endpoints.
  - **Security Controls**:
    - Always use `crypto.timingSafeEqual` for comparing secrets to prevent timing attacks.
    - Enforce HTTPS in production.
    - Rate limit login endpoints to prevent brute force attacks.

## ✅ Implementation Checklist (AI Usage)

Before finalizing code, the AI must verify:

- [ ] Is Drizzle ORM used? (If raw SQL, is it justified?)
- [ ] Are there any potential N+1 query issues?
- [ ] Have I checked all usages of the modified function?
- [ ] Are comments concise and focusing on "Why"? (No fluff).
- [ ] Are types strict (no `any`)?
- [ ] Is authentication implemented securely (timingSafeEqual, env vars for system auth)?
