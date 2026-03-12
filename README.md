# 🚀 Bun + Hono + Redis Microservices Boilerplate (CQRS + Event-Driven)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Bun](https://img.shields.io/badge/Bun-v1.1+-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-v4+-E36002?logo=hono&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Streams-DC382D?logo=redis&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Relational_DB-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

High-performance microservices starter kit. Built with **Bun** runtime, **Hono** web framework, **PostgreSQL** (with Drizzle ORM), and **Redis Streams** for event-driven communication.

This boilerplate implements the **CQRS** (Command Query Responsibility Segregation) pattern, ensuring a clean separation between read and write operations, and uses **Redis Streams** for asynchronous inter-service communication.

---

## 📚 Table of Contents

- [Features](#-features)
- [Architecture](#-system-architecture)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
  - [1. Clone & Install](#1-clone--install)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Start Infrastructure](#3-start-infrastructure-redis--postgres)
  - [4. Database Setup](#4-database-setup-migrations--seeds)
  - [5. Run Services](#5-run-services)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Features

- **Microservices Architecture**: Independent services for Auth, User, and Product domains.
- **Event-Driven**: Asynchronous communication via Redis Streams (durable log).
- **CQRS Pattern**: Distinct Command and Query paths for optimized performance and scalability.
- **High Performance**: Built on Bun (fast JS runtime) and Hono (ultrafast web framework).
- **Type Safety**: Full TypeScript support with Zod validation.
- **Modern ORM**: Drizzle ORM for type-safe SQL queries and migrations.
- **Authentication**: JWT (Stateless) for API access + Stateful Session validation (Redis-style logic in Postgres).
- **Internal APIs**: Secured System-to-System communication using Basic Auth.
- **Documentation**: Auto-generated OpenAPI (Swagger) docs for every service.

---

## 🏗 System Architecture

### High-Level Overview

```mermaid
graph TB
  subgraph Client_Layer
    Client[Web / Mobile Client]
  end

  subgraph API_Gateway_Logic
    direction TB
    Auth[🔐 Auth Service :3100]
    User[👤 User Service :3101]
    Prod[📦 Product Service :3102]
  end

  subgraph Infrastructure
    PG[(🐘 PostgreSQL)]
    Redis[(🧠 Redis Streams)]
  end

  Client -->|HTTP/REST| Auth
  Client -->|HTTP/REST| User
  Client -->|HTTP/REST| Prod

  Auth -->|SQL| PG
  User -->|SQL| PG
  Prod -->|SQL| PG

  Auth <-->|Streams| Redis
  User <-->|Streams| Redis
  Prod <-->|Streams| Redis
```

### Event-Driven Flow (CQRS Example)

When a product is created, the write operation happens synchronously, but other services are notified asynchronously via Redis Streams.

```mermaid
sequenceDiagram
  participant C as Client
  participant P as Product Service
  participant D as PostgreSQL
  participant K as Redis Streams
  participant U as User Service

  Note over C,P: Command Side (Write)
  C->>P: POST /products (Create Product)
  P->>D: INSERT into products table
  P->>K: XADD "products.created" event
  P-->>C: 201 Created

  Note over K,U: Async Event Processing
  K->>U: XREADGROUP "products.created"
  U->>U: Update internal stats / Log activity
```

---

## � Project Structure

```bash
bun-hono-redis-pubsub-boilerplate/
├── infra/                  # Infrastructure configurations
│   └── redis/
│       └── docker-compose.yml  # Redis Streams
├── docs/                   # Centralized documentation
│   └── api-documentation/  # Detailed API specs
├── service-auth/           # 🔐 Authentication Service
│   ├── src/
│   │   ├── application/    # Use Cases & Business Logic
│   │   ├── domain/         # Entities & Domain Models
│   │   ├── infrastructure/ # DB, Redis, Repositories
│   │   └── interface/      # HTTP Handlers (Hono)
│   └── drizzle/            # Migrations
├── service-user/           # 👤 User Management Service
│   └── ... (similar structure)
├── service-product/        # 📦 Product Catalog Service
│   └── ... (similar structure)
├── .gitignore
├── package.json            # Workspace configuration
└── README.md
```

---

## ✅ Prerequisites

Before you begin, ensure you have the following installed:

1.  **Bun** (v1.1 or later)
    ```bash
    curl -fsSL https://bun.sh/install | bash
    ```
2.  **Docker & Docker Compose** (For running Redis and PostgreSQL)
3.  **Git**

---

## 🚀 Getting Started

Follow these steps strictly to get the boilerplate running locally.

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

**Critical Variables Explained:**

| Variable      | Description                                    | Default (Local)                                     |
| :------------ | :--------------------------------------------- | :-------------------------------------------------- |
| `DB_URL`      | Connection string for PostgreSQL               | `postgresql://postgres:postgres@localhost:5432/...` |
| `REDIS_HOST`  | Redis host                                     | `localhost`                                         |
| `REDIS_PORT`  | Redis port                                     | `6379`                                              |
| `JWT_SECRET`  | Secret key for signing access tokens           | Change this in production!                          |
| `SYSTEM_USER` | Username for internal service-to-service calls | `admin`                                             |
| `SYSTEM_PASS` | Password for internal service-to-service calls | `admin123`                                          |

### 3. Start Infrastructure (Redis & Postgres)

We use Docker to run the required infrastructure.

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

1.  **Seed Users**: Creates Admin and Default User.

    ```bash
    cd service-user && bun run db:seed
    ```

    _Credentials created:_
    - Admin: `admin@example.com` / `Admin123!`
    - User: `user@example.com` / `User123!`

2.  **Start User Service**: Required because Product seeding fetches user IDs via API.

    ```bash
    # Open a new terminal
    cd service-user && bun run dev
    ```

3.  **Seed Products**: Fetches the oldest user to set as the "owner" of products.
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
| :---------- | :---------------------- | :---------------------------------- | :---------------------------------- |
| **Auth**    | `http://localhost:3100` | [/docs](http://localhost:3100/docs) | Login, Register, Session Management |
| **User**    | `http://localhost:3101` | [/docs](http://localhost:3101/docs) | CRUD Users, Internal User Lookup    |
| **Product** | `http://localhost:3102` | [/docs](http://localhost:3102/docs) | CRUD Products, Variant Management   |

**Detailed Markdown Docs:**

- [Auth Service API Docs](docs/api-documentation/service-auth-api.md)
- [User Service API Docs](docs/api-documentation/service-user-api.md)
- [Product Service API Docs](docs/api-documentation/service-product-api.md)

---

## � Deployment

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

## 🔧 Troubleshooting

| Issue                               | Possible Cause                               | Solution                                                                |
| :---------------------------------- | :------------------------------------------- | :---------------------------------------------------------------------- |
| **Connection Refused (Redis)**      | Redis container not running or ports blocked | Run `bun run redis:up` and check `docker ps`.                           |
| **Relation does not exist**         | Migrations not run                           | Run `bun run db:setup` in the affected service.                         |
| **401 Unauthorized (Internal API)** | System credentials mismatch                  | Ensure `SYSTEM_USER` and `SYSTEM_PASS` match in all `.env` files.       |
| **Seed Failed (Product)**           | User Service not reachable                   | Ensure User Service is running (`bun run dev`) before seeding products. |
| **Bun install fails**               | Network or Lockfile issue                    | Delete `bun.lockb` and `node_modules`, then run `bun install` again.    |

---

## 📜 License

This project is licensed under the MIT License.
