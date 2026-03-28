# 🚀 Bun + Hono + Redis Microservices Boilerplate (CQRS + Event-Driven)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Bun](https://img.shields.io/badge/Bun-v1.1+-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-v4+-E36002?logo=hono&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Streams-DC382D?logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

High-performance microservices starter kit. Built with **Bun** runtime, **Hono** web framework, **PostgreSQL** (with Drizzle ORM), and **Redis Streams** for event-driven communication.

This boilerplate implements the **CQRS** (Command Query Responsibility Segregation) pattern, ensuring a clean separation between read and write operations, and uses **Redis Streams** for asynchronous inter-service communication.

---

## 🎯 Why This Boilerplate?

- **Production Ready** - CORS, Error Handling, JWT Validation, Graceful Shutdown built-in
- **Fast Development** - Auto-generated OpenAPI docs, hot reload, seed scripts
- **Event-Driven** - Redis Streams for async inter-service communication
- **CQRS Pattern** - Clean separation between read and write operations
- **Type Safe** - Full TypeScript + Zod validation + Drizzle ORM

---

## ✨ Features

- **Microservices Architecture**: Independent services for Auth, User, and Product domains.
- **Event-Driven**: Asynchronous communication via Redis Streams (durable log).
- **CQRS Pattern**: Distinct Command and Query paths for optimized performance and scalability.
- **High Performance**: Built on Bun (fast JS runtime) and Hono (ultrafast web framework).
- **Type Safety**: Full TypeScript support with Zod validation.
- **Modern ORM**: Drizzle ORM for type-safe SQL queries and migrations.
- **Authentication**: JWT (Stateless) for API access + Basic Auth for internal APIs.
- **Internal APIs**: Secured System-to-System communication using Basic Auth.
- **Documentation**: Auto-generated OpenAPI (Swagger) docs for every service.
- **CORS Restriction**: Environment-specific origin allowlist with credentials support.
- **Global Error Handler**: Consistent error responses with AppError class hierarchy.
- **JWT Validation**: Startup validation with blacklist + minimum length checks.
- **Graceful Shutdown**: SIGTERM/SIGINT handling with connection cleanup.
- **Request ID Middleware**: Request correlation across services via X-Request-ID header.
- **Circuit Breaker**: Opossum-based fault tolerance for external calls.
- **Rate Limiting**: Redis-backed per-route rate limiting.

---

## 🏗 System Architecture

### High-Level Overview

```mermaid
graph TB
    subgraph Client["🌐 Client Layer"]
        C[Web / Mobile]
    end

    subgraph Services["⚙️ API Services"]
        direction LR
        A[🔐 Auth<br/>:3100]
        U[👤 User<br/>:3101]
        P[📦 Product<br/>:3102]
    end

    subgraph Infra["🗄️ Infrastructure"]
        DB[(🐘 PostgreSQL<br/>Drizzle ORM)]
        R[(🧠 Redis Streams)]
    end

    C -->|HTTP/REST| A
    C -->|HTTP/REST| U
    C -->|HTTP/REST| P

    A --> DB
    U --> DB
    P --> DB

    A <-->|Events| R
    U <-->|Events| R
    P <-->|Events| R
```

### Event-Driven Flow (CQRS Example)

When a product is created, the write operation happens synchronously, but other services are notified asynchronously via Redis Streams.

```mermaid
sequenceDiagram
    participant C as Client
    participant P as Product Service
    participant DB as PostgreSQL
    participant R as Redis Streams
    participant U as User Service

    C->>P: POST /products (Create)
    P->>DB: INSERT product
    P->>R: XADD "products.created"
    P-->>C: 201 Created

    R-->>U: XREADGROUP (async)
    U->>U: Update activity logs
```

---

## 📁 Project Structure

```
bun-hono-redis-pubsub-boilerplate/
├── service-auth/                 # 🔐 Authentication Service (Port 3100)
│   ├── src/
│   │   ├── app.ts               # Hono app + middleware
│   │   ├── index.ts             # Entry point with graceful shutdown
│   │   ├── config/
│   │   │   ├── loader.ts        # Zod-validated config loader
│   │   │   └── jwt-validation.ts # JWT secret validation
│   │   ├── db/
│   │   │   ├── connection.ts    # Drizzle + Postgres connection
│   │   │   └── schema.ts       # Database schema
│   │   ├── helpers/
│   │   │   ├── errors.ts       # AppError class hierarchy
│   │   │   ├── api-response.ts # Standardized responses
│   │   │   └── redis.ts        # Redis Streams producer
│   │   ├── middlewares/
│   │   │   ├── auth.ts         # JWT authentication
│   │   │   ├── request-id.ts   # Request ID propagation
│   │   │   └── rate-limit.ts   # Rate limiting
│   │   └── modules/auth/
│   │       └── handlers/        # Route handlers
│   └── .env.example
├── service-user/                 # 👤 User Management Service (Port 3101)
│   └── ... (similar structure)
├── service-product/             # 📦 Product Catalog Service (Port 3102)
│   └── ... (similar structure)
├── infra/redis/                 # Redis docker-compose
├── docs/plans/                  # Implementation design docs
└── memory/                      # Project conventions (MEMORY.md)
```

---

## ✅ Prerequisites

Before you begin, ensure you have the following installed:

1. **Bun** (v1.1 or later)
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```
2. **Docker & Docker Compose** (For running Redis and PostgreSQL)
3. **Git**

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/aldoignatachandra/Bun-Hono-Redis-PubSub-Boilerplate.git
cd Bun-Hono-Redis-PubSub-Boilerplate

# Install dependencies for all services (Workspace)
bun install
```

### 2. Environment Configuration

You need to configure environment variables for **each** service. We provide `.env.example` files.

```bash
# Copy env files
cp service-auth/.env.example service-auth/.env
cp service-user/.env.example service-user/.env
cp service-product/.env.example service-product/.env
```

**Environment Variables:**

| Variable                | Description                       | Default                                                       |
| ----------------------- | --------------------------------- | ------------------------------------------------------------- |
| `NODE_ENV`              | Environment mode                  | `dev`                                                         |
| `DB_URL`                | PostgreSQL connection string      | `postgresql://postgres:postgres@localhost:5432/cqrs_demo_dev` |
| `DB_POOL_MAX`           | Max database connections          | `20`                                                          |
| `DB_IDLE_TIMEOUT`       | Idle timeout (seconds)            | `20`                                                          |
| `DB_CONNECTION_TIMEOUT` | Connection timeout (seconds)      | `10`                                                          |
| `JWT_SECRET`            | JWT signing secret (min 32 bytes) | `dev-secret-change-me-in-prod`                                |
| `REDIS_HOST`            | Redis host                        | `localhost`                                                   |
| `REDIS_PORT`            | Redis port                        | `6379`                                                        |
| `CORS_ALLOWED_ORIGINS`  | Allowed CORS origins              | `*`                                                           |
| `SYSTEM_USER`           | Internal API username             | `admin`                                                       |
| `SYSTEM_PASS`           | Internal API password             | `admin123`                                                    |

### 3. Start Infrastructure (Redis & Postgres)

**Start Redis:**

```bash
bun run redis:up
```

_Redis will be ready within a few seconds._

**Start PostgreSQL:**
(If you don't have a local Postgres instance)

```bash
docker run --name cqrs-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=cqrs_demo_dev \
  -p 5432:5432 \
  -d postgres:15-alpine
```

### 4. Database Setup (Migrations & Seeds)

Initialize the database schema for all services.

```bash
# Run migrations for each service
cd service-auth && bun run db:setup && cd ..
cd service-user && bun run db:setup && cd ..
cd service-product && bun run db:setup && cd ..
```

**Seeding Data (Order is Important!):**

1. **Seed Users**: Creates Admin and Default User.

   ```bash
   cd service-user && bun run db:seed
   ```

   _Credentials created:_
   - Admin: `admin@example.com` / `Admin123!`
   - User: `user@example.com` / `User123!`

2. **Start User Service**: Required because Product seeding fetches user IDs via API.

   ```bash
   # Open a new terminal
   cd service-user && bun run dev
   ```

3. **Seed Products**: Fetches the oldest user to set as the "owner" of products.
   ```bash
   cd service-product && bun run db:seed
   ```

### 5. Run Services

You can run all services simultaneously using a workspace script (if configured) or in separate terminals.

**Terminal 1 (Auth):**

```bash
cd service-auth && bun run dev
```

**Terminal 2 (User):**

```bash
cd service-user && bun run dev
```

**Terminal 3 (Product):**

```bash
cd service-product && bun run dev
```

---

## 📖 API Documentation

Each service exposes an interactive Swagger UI.

| Service     | Base URL                | Swagger UI                          | Key Features                        |
| ----------- | ----------------------- | ----------------------------------- | ----------------------------------- |
| **Auth**    | `http://localhost:3100` | [/docs](http://localhost:3100/docs) | Login, Register, Session Management |
| **User**    | `http://localhost:3101` | [/docs](http://localhost:3101/docs) | CRUD Users, Internal User Lookup    |
| **Product** | `http://localhost:3102` | [/docs](http://localhost:3102/docs) | CRUD Products, Variant Management   |

---

## 🔧 Available Scripts

| Script                  | Description                   |
| ----------------------- | ----------------------------- |
| `bun run dev`           | Start all services (parallel) |
| `bun run build`         | Build all services            |
| `bun run lint`          | Lint all services             |
| `bun run format`        | Format all services           |
| `bun run redis:up`      | Start Redis container         |
| `bun run redis:down`    | Stop Redis container          |
| `bun test`              | Run all tests                 |
| `bun run test:coverage` | Run tests with coverage       |

---

## 📦 API Response Format

All responses follow a consistent format:

**Success:**

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error:**

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": { ... }
  }
}
```

---

## ⚡ Error Handling

Throw errors from handlers - the global error handler formats them automatically:

```typescript
// Throws 400 with VALIDATION_ERROR code
throw new ValidationError({ field: "email", message: "Invalid email" });

// Throws 404 with NOT_FOUND code
throw new NotFoundError("User", userId);

// Throws 401 with UNAUTHORIZED code
throw new UnauthorizedError();

// Throws 403 with FORBIDDEN code
throw new ForbiddenError();

// Throws 409 with CONFLICT code
throw new ConflictError("User already exists");
```

---

## 🚢 Deployment

To deploy this microservices architecture, you should build Docker images for each service.

**Example `Dockerfile` for a service:**

```dockerfile
FROM oven/bun:1.1 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Run
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

**Recommended Production Setup:**

- **Reverse Proxy**: Nginx or Traefik in front of the services.
- **Managed Database**: AWS RDS or similar for PostgreSQL.
- **Managed Redis**: Redis Cloud or AWS ElastiCache.
- **Orchestration**: Kubernetes (K8s) or Docker Swarm.

---

## 🔍 Troubleshooting

| Issue                               | Possible Cause                               | Solution                                                                |
| ----------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| **Connection Refused (Redis)**      | Redis container not running or ports blocked | Run `bun run redis:up` and check `docker ps`.                           |
| **Relation does not exist**         | Migrations not run                           | Run `bun run db:setup` in the affected service.                         |
| **401 Unauthorized (Internal API)** | System credentials mismatch                  | Ensure `SYSTEM_USER` and `SYSTEM_PASS` match in all `.env` files.       |
| **Seed Failed (Product)**           | User Service not reachable                   | Ensure User Service is running (`bun run dev`) before seeding products. |
| **Bun install fails**               | Network or Lockfile issue                    | Delete `bun.lockb` and `node_modules`, then run `bun install` again.    |

---

## 📜 License

This project is licensed under the MIT License.
