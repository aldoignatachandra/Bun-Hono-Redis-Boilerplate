# 🚀 Bun + Hono + Kafka Microservices Boilerplate (CQRS + Event-Driven)

Production-ready microservices starter built on **Bun**, **Hono**, **PostgreSQL**, and **Kafka**. This repo gives you a clean CQRS foundation, strict API docs, rate limits, auth, and event-driven workflows with real service boundaries.

## 🧭 Quick Links

- [Auth Service API](docs/api-documentation/service-auth-api.md)
- [User Service API](docs/api-documentation/service-user-api.md)
- [Product Service API](docs/api-documentation/service-product-api.md)

## �️ Tech Stack Logos

![Bun](https://techicons.dev/icons/bun?size=64)
![Hono](https://commons.wikimedia.org/wiki/Special:FilePath/Hono-logo.svg)
![Apache Kafka](https://www.vectorlogo.zone/logos/apache_kafka/apache_kafka-icon.svg)
![PostgreSQL](https://www.vectorlogo.zone/logos/postgresql/postgresql-icon.svg)

---

## ✅ What You Get

- **3 services** with clean boundaries: Auth, User, Product
- **CQRS** pattern (Commands + Queries + Repositories)
- **Kafka event streams** with explicit topics
- **OpenAPI docs** with Swagger UI per service
- **JWT auth**, **Basic Auth** for system routes
- **Rate limiting** at the edge
- **Migrations + seeding** via Drizzle

---

## �️ System Architecture

```mermaid
graph TB
  subgraph Client
    A[Web / Mobile Client]
  end

  subgraph Services
    AUTH[Auth Service :3100]
    USER[User Service :3101]
    PRODUCT[Product Service :3102]
  end

  subgraph Data
    PG[(PostgreSQL)]
    KAFKA[(Kafka Cluster)]
  end

  A --> AUTH
  A --> USER
  A --> PRODUCT

  AUTH --> PG
  USER --> PG
  PRODUCT --> PG

  AUTH <--> KAFKA
  USER <--> KAFKA
  PRODUCT <--> KAFKA
```

### CQRS Request Flow

```mermaid
sequenceDiagram
  participant Client
  participant API as Product Service
  participant DB as PostgreSQL
  participant Kafka

  Client->>API: POST /products
  API->>DB: Create product (Command)
  API->>Kafka: Publish products.created
  API-->>Client: 201 Created
```

---

## 📦 Services & Ports

| Service | Description                          | Port | OpenAPI |
| ------- | ------------------------------------ | ---- | ------- |
| Auth    | Login, logout, session management    | 3100 | `/docs` |
| User    | Admin user management + internal API | 3101 | `/docs` |
| Product | Product catalog & variants           | 3102 | `/docs` |

---

## ✅ Required Infrastructure

This repo **requires** both:

1. **PostgreSQL** (shared DB with per-service schemas)
2. **Kafka** (local 2-node KRaft cluster + UI)

---

## 🚀 Step-by-Step Setup (Local)

### 1. Clone the Repo

```bash
git clone https://github.com/your-username/bun-hono-kafkajs-boilerplate.git
cd bun-hono-kafkajs-boilerplate
```

### 2. Install Dependencies

```bash
cd service-auth && bun install && cd ..
cd service-user && bun install && cd ..
cd service-product && bun install && cd ..
```

### 3. Configure Environment Variables

Copy `.env.example` into **each** service:

```bash
cp service-auth/.env.example service-auth/.env
cp service-user/.env.example service-user/.env
cp service-product/.env.example service-product/.env
```

Required variables per service:

| Key               | Description            | Example                                                                     |
| ----------------- | ---------------------- | --------------------------------------------------------------------------- |
| `PORT`            | Service port           | `3100`, `3101`, `3102`                                                      |
| `DB_URL`          | PostgreSQL connection  | `postgresql://postgres:postgres@localhost:5432/cqrs_demo_dev?schema=public` |
| `JWT_SECRET`      | JWT signing secret     | `your-secret-key`                                                           |
| `KAFKA_BROKERS`   | Kafka brokers          | `localhost:19092,localhost:29092`                                           |
| `KAFKA_CLIENT_ID` | Kafka client id        | `service-auth`, `service-user`, `service-product`                           |
| `SYSTEM_USER`     | System Basic Auth user | `admin`                                                                     |
| `SYSTEM_PASS`     | System Basic Auth pass | `admin123`                                                                  |

### 4. Start Kafka (Required)

```bash
bun run kafka:up
```

Kafka cluster:

- Broker 1: `localhost:19092`
- Broker 2: `localhost:29092`
- Kafka UI: `http://localhost:8080`

Stop Kafka:

```bash
bun run kafka:down
```

### 5. Start PostgreSQL (Required)

If you don’t already have Postgres running:

```bash
docker run --name cqrs-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=cqrs_demo_dev \
  -p 5432:5432 \
  -d postgres:15
```

### 6. Run Migrations

```bash
cd service-auth && bun run db:setup && cd ..
cd service-user && bun run db:setup && cd ..
cd service-product && bun run db:setup && cd ..
```

### 7. Seed Data (Order Matters)

1. Seed **User Service** (creates admin + user accounts):

```bash
cd service-user && bun run db:seed
```

Default credentials created:

- `admin@example.com` / `Admin123!`
- `user@example.com` / `User123!`

2. Start User Service (required for product seeding):

```bash
cd service-user && bun run dev
```

3. Seed **Product Service** (requires User Service):

```bash
cd service-product && bun run db:seed
```

### 8. Run All Services

From repo root:

```bash
bun run dev
```

Or run individually:

```bash
cd service-auth && bun run dev
cd service-user && bun run dev
cd service-product && bun run dev
```

### 9. Verify Everything

```bash
curl http://localhost:3100/health
curl http://localhost:3101/health
curl http://localhost:3102/health
```

Swagger UI:

- Auth: `http://localhost:3100/docs`
- User: `http://localhost:3101/docs`
- Product: `http://localhost:3102/docs`

---

## 🧪 Development Commands

From repo root:

```bash
bun run dev
bun run build
bun run test
bun run lint
```

Per service (example for user service):

```bash
cd service-user
bun run dev
bun run test
bun run lint
bun run db:generate
bun run db:migrate
```

---

## 📡 Kafka Topics (Current)

| Topic               | Event Types                 | Source  |
| ------------------- | --------------------------- | ------- |
| `auth.events`       | `auth.login`, `auth.logout` | Auth    |
| `users.created`     | `user.created`              | User    |
| `users.restored`    | `user.restored`             | User    |
| `users.deleted`     | `user.deleted`              | User    |
| `products.created`  | `product.created`           | Product |
| `products.updated`  | `product.updated`           | Product |
| `products.deleted`  | `product.deleted`           | Product |
| `products.restored` | `product.restored`          | Product |

---

## 🔐 Authentication Summary

| Type       | Used By                      | Header                      |
| ---------- | ---------------------------- | --------------------------- |
| Basic Auth | `/auth/login`, system routes | `Authorization: Basic ...`  |
| Bearer JWT | Protected endpoints          | `Authorization: Bearer ...` |

JWT expiry is **1 day** by default.

---

## 🧩 Service-to-Service Rules

- Product seed uses **User Service internal API**:
  - `/api/internal/users/oldest`
- Requires `SYSTEM_USER` + `SYSTEM_PASS`
- User Service must be running before product seeding

---

## � Troubleshooting

| Symptom                 | Cause                    | Fix                              |
| ----------------------- | ------------------------ | -------------------------------- |
| Kafka connection errors | Kafka not running        | `bun run kafka:up`               |
| Product seed fails      | User service not running | Start `service-user` first       |
| 401 on internal API     | Wrong system auth        | Update `SYSTEM_USER/SYSTEM_PASS` |
| DB errors               | Postgres not running     | Start Postgres container         |

---

## 🤝 Contributing

Commit message rules are enforced via Husky + Commitlint:

```bash
git commit -m "add: new feature"
git commit -m "fix: login issue"
git commit -m "update: docs"
```

---

## 📚 API Documentation

All service docs live in [docs/api-documentation](docs/api-documentation).

OpenAPI JSON for each service:

- Auth: `/docs/openapi.json`
- User: `/docs/openapi.json`
- Product: `/docs/openapi.json`
