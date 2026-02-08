# 🚀 Bun + Hono + Kafka Microservices (Simple CQRS Boilerplate)

## 📋 Executive Summary

This is a **high-performance, scalable microservices boilerplate** built with modern technologies. It implements the **CQRS (Command Query Responsibility Segregation)** pattern and **Event-Driven Architecture** using Apache Kafka.

Designed for efficiency and developer experience, it features **Bun** for ultra-fast runtime performance, **Hono** for lightweight HTTP handling, and **Drizzle ORM** for type-safe, optimized database interactions.

## 🛠️ Technology Stack

### ⚡ Runtime & Web Framework

- **🥤 Bun**: Ultra-fast JavaScript runtime, bundler, test runner, and package manager (v1.1+).
- **🔥 Hono**: Fast, lightweight, web-standard framework with first-class TypeScript support.

### 🏗️ Architecture Patterns

- **🔄 CQRS**: Distinct separation of Write (Command) and Read (Query) models for scalability.
- **📡 Event-Driven**: Asynchronous service-to-service communication via **Kafka**.
- **🎯 DDD (Domain-Driven Design)**: Clear bounded contexts (`User`, `Product`, `Auth`).
- **💉 Dependency Injection**: **TypeDI** for loose coupling and testability.

### 🗄️ Data Layer

- **🐘 PostgreSQL**: Robust, ACID-compliant relational database.
- **🔮 Drizzle ORM**: TypeScript-first ORM with zero runtime overhead and SQL-like syntax.
- **⚡ Optimization**:
  - **Pagination**: All list endpoints support `limit` and `offset`.
  - **Filtering**: efficient DB-level filtering (no in-memory processing).
  - **Paranoid Deletes**: Soft-delete support with `deletedAt` columns.

### 📨 Messaging

- **🎭 Apache Kafka**: Distributed event streaming (KRaft mode - no Zookeeper).
- **📜 KafkaJS**: Robust Node.js client with retries, batching, and DLQ support.

### 🔐 Security

- **🎫 JWT**: Stateless authentication.
- **🛡️ RBAC**: Role-Based Access Control (`ADMIN`, `USER`).
- **🔑 Bcrypt**: Secure password hashing.

---

## 🏛️ System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A[📱 Client Apps] --> C[🌐 API Gateway (LB)]
        B[🖥️ Admin Panel] --> C
    end

    subgraph "Service Layer"
        C --> D[👤 User Service<br/>:3101]
        C --> E[📦 Product Service<br/>:3102]
        C --> H[🔐 Auth Service<br/>:3100]
        D <--> F[🎭 Kafka Cluster]
        E <--> F
    end

    subgraph "Data Layer"
        D --> G[🐘 PostgreSQL]
        E --> G
    end

    style A fill:#e1f5fe
    style B fill:#e8f5e9
    style C fill:#fff3e0
    style D fill:#f3e5f5
    style E fill:#e0f2f1
    style F fill:#fce4ec
    style G fill:#e1f5fe
    style H fill:#fff9c4
```

### 🔄 Data Flow (CQRS)

1.  **Command (Write)**:
    - User sends `POST /products`.
    - API validates token & payload.
    - Command Handler persists data to DB.
    - **Event Published**: `ProductCreated` -> Kafka.
    - Response returned immediately.

2.  **Query (Read)**:
    - User sends `GET /products?search=laptop`.
    - Query Handler executes **Optimized SQL** via Drizzle.
    - Results returned with pagination metadata.

---

## 📁 Project Structure

```bash
bun-hono-kafkajs-boilerplate/
├── infra/                 # Docker & Kafka config
├── service-user/          # 👤 User Management & Auth
│   ├── src/
│   │   ├── modules/user/
│   │   │   ├── handlers/  # HTTP Controllers
│   │   │   ├── repositories/ # Drizzle & Commands/Queries
│   │   │   └── domain/    # Schema & Types
├── service-product/       # 📦 Product Catalog
│   ├── src/
│   │   ├── modules/product/
│   │   │   ├── handlers/
│   │   │   └── repositories/
├── service-auth/          # 🔐 Centralized Auth Gateway
└── .trae/                 # 🤖 AI Rules & Guidelines
```

---

## 🚀 Getting Started

### Prerequisites

- **Bun** (v1.1+)
- **Docker & Docker Compose**

### 1. Installation

```bash
# Clone the repo
git clone https://github.com/your-username/bun-hono-kafkajs-boilerplate.git
cd bun-hono-kafkajs-boilerplate

# Install dependencies for all services
cd service-user && bun install && cd ..
cd service-product && bun install && cd ..
cd service-auth && bun install && cd ..
```

### 2. Environment Setup

Copy `.env.example` to `.env` in **EACH** service directory (`service-user`, `service-product`, `service-auth`).

**Crucial Setting for Local Dev:**
Ensure `KAFKA_BROKERS=localhost:19092,localhost:29092` in all `.env` files.

### 3. Start Infrastructure

```bash
# Start Postgres & Kafka
docker compose -f infra/docker/compose/dev.yml up -d
```

### 4. Database Migration & Seeding

```bash
# Push schema and seed Admin user
cd service-user
bun run db:push
bun run db:seed  # Creates admin@example.com / admin
cd ..

cd service-product
bun run db:push
cd ..
```

### 5. Run Services

Open 3 terminals:

```bash
# Terminal 1
cd service-user && bun run dev
# Terminal 2
cd service-product && bun run dev
# Terminal 3
cd service-auth && bun run dev
```

---

## 🧪 API Usage Guide

### Authentication

**Login (Get Token)**

```bash
curl -X POST http://localhost:3101/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin"}'
```

_Response:_ `{ "token": "eyJ...", "user": { ... } }`

### Product Management (Optimized)

**Get Products (Filtered & Paginated)**

```bash
curl "http://localhost:3102/products?page=1&limit=5&search=laptop&minPrice=1000" \
  -H "Authorization: Bearer <TOKEN>"
```

**Parameters:**

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `search`: Filter by name (case-insensitive)
- `minPrice` / `maxPrice`: Price range filter
- `includeDeleted`: Include soft-deleted items (boolean)

### User Management (Admin Only)

**List Users**

```bash
curl "http://localhost:3101/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 🛠️ Best Practices Implemented

1.  **N+1 Prevention**: All repository methods use optimized Drizzle queries, avoiding loops for data fetching.
2.  **Pagination**: Mandatory for all list endpoints to ensure scalability.
3.  **Clean Architecture**: Separation of `Handlers` (HTTP), `Commands` (Write Logic), `Queries` (Read Logic), and `Repositories` (Data Access).
4.  **Type Safety**: Full TypeScript strict mode compliance.
5.  **Validation**: Zod schemas for all request bodies.

## 🤝 Contributing

Please follow the rules in `.trae/` when contributing:

- **`universal_code_style.md`**: Formatting & Naming.
- **`backend_best_practices.md`**: Architecture & Performance.

### 🛑 Git Workflow & Commit Rules

This project uses **Husky** and **Commitlint** to enforce strict commit message conventions.

**Allowed Commit Types:**

- `update:` - Use for updates to existing code, dependencies, or documentation.
- `add:` - Use when adding new features, files, or modules.
- `fix:` - Use when fixing bugs or resolving issues.

**Example Valid Commits:**

```bash
git commit -m "add: new product search filter"
git commit -m "update: readme documentation"
git commit -m "fix: login authentication error"
```

**Invalid Commits (Will Fail):**

```bash
git commit -m "fixed login"       # ❌ Missing prefix
git commit -m "feat: new login"   # ❌ 'feat' is not allowed (use 'add')
git commit -m "wip"               # ❌ Random messages not allowed
```

> The pre-commit hook is currently configured to skip tests (`bun test` is commented out) but will run linter checks in the future.
