# Production-Grade Reusable Backend Starter Kit

An enterprise-ready, modular, and scalable backend boilerplate designed for rapid, production-grade API development with Node.js, Express, TypeScript, and MongoDB.

---

## Architecture Overview

This starter kit follows a **Modular Monolith** architecture with strict separation of concerns across layers:

- **`src/config/`**: Centralized, fail-fast configuration validated via Zod.
- **`src/core/`**: Framework-agnostic foundation (custom error hierarchy, standard response format, pagination helpers, constants, types).
- **`src/infrastructure/`**: Pluggable external service integrations (Database, Redis Cache, Kafka, BullMQ, Storage, Email).
- **`src/shared/`**: Cross-cutting HTTP middlewares (Request ID tracing, rate limiting, auth guards, global error handling) and validation helpers.
- **`src/modules/`**: Isolated, domain-driven business feature modules (e.g., `auth`, `users`, `notifications`).

---

## Project Structure

```
backend/
├── src/
│   ├── app.ts                          # Express application factory
│   ├── server.ts                       # Server bootstrap and graceful shutdown
│   ├── config/                         # Unified configuration and environment validation
│   ├── core/                           # Core primitives (errors, http envelope, types)
│   ├── infrastructure/                 # External service clients (MongoDB, Redis, Kafka)
│   ├── shared/                         # Middlewares and cross-cutting helpers
│   ├── modules/                        # Domain feature modules
│   ├── jobs/                           # Background queue processors
│   ├── events/                         # Event-driven publishers and consumers
│   └── docs/                           # OpenAPI documentation
├── tests/                              # Unit, integration, and E2E test suites
├── scripts/                            # Database seed and generator scripts
├── docker/                             # Dockerfile and Docker Compose configurations
├── .env.example                        # Template for required environment variables
├── package.json                        # Dependencies and scripts
├── tsconfig.json                       # Strict TypeScript configuration
└── PRD.md                              # Comprehensive requirements and checklist
```

---

## Getting Started

### 1. Prerequisites

- **Node.js**: v20+ LTS
- **npm**: v10+

### 2. Environment Setup

Copy the example environment configuration file:

```bash
cp .env.example .env
```

### 3. Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Compile TypeScript to JavaScript
npm run build

# Start production build
npm start

# Run type checking without emit
npm run typecheck

# Run linter
npm run lint

# Format code with Prettier
npm run format

# Run automated tests
npm run test
```

---

## Quality Gates and Pre-Commit Hooks

Every `git commit` automatically triggers:

1. `tsc --noEmit` (Full project typecheck)
2. `eslint --fix` (Linting on staged files)
3. `prettier --write` (Formatting on staged files)

---

## Current Roadmap Status

- [x] **Phase 1:** Foundation, Configuration, Error Handling, Quality Gates
- [x] **Phase 2:** MongoDB + Mongoose Integration, Models, Validation _(In Progress)_
- [ ] **Phase 3:** Authentication (JWT, Refresh Tokens, Cookies), RBAC, Security
- [ ] **Phase 4:** Redis Caching, Distributed Locks, Rate Limiting
- [ ] **Phase 5:** BullMQ Background Jobs & Workers
- [ ] **Phase 6:** Email, Notifications, Storage (S3 / Local), PDF Generation
- [ ] **Phase 7:** Kafka Event-Driven Messaging & Transactional Outbox
- [ ] **Phase 8:** Structured Observability, Prometheus Metrics, Full Testing
- [ ] **Phase 9:** Dockerization, CI/CD, OpenAPI / Swagger Docs
- [ ] **Phase 10:** Multi-Tenancy, Reliability Patterns, Final Developer Kit

---

## Implemented Modules

### 1. User Model (`src/modules/users/users.model.ts`)

- **Fields**: `name`, `email` (unique, lowercase, indexed), `password` (`select: false`), `role` (`user` / `admin`), `tenantId` (optional indexed ObjectId for SaaS multi-tenancy), `isEmailVerified`, `refreshToken` (`select: false`), timestamps.
- **Security Invariant**: Sensitive fields (`password`, `refreshToken`) have `select: false` set at the schema level to prevent accidental data leaks in API responses.
- **SaaS Multi-Tenancy Ready**: The optional indexed `tenantId` enables strict workspace/company data partitioning for B2B SaaS without affecting single-tenant B2C usage.

### 2. Multi-Tenant Request Middleware (`src/shared/middleware/tenant.middleware.ts`)

- **Automatic Extraction**: Automatically inspects every incoming HTTP request for the `x-tenant-id` header (or downstream auth token / subdomain) and securely binds it to `req.tenantId`.
- **Response Reflection**: Attaches `x-tenant-id` to the response headers for end-to-end trace correlation and client-side workspace confirmation.
- **Type-Safe**: Extends Express `Request` interface globally so `req.tenantId` is strictly typed (`string | null`) throughout all controllers, services, and middlewares without unsafe type assertions.

### 3. Generic Validation Middleware (`src/shared/middleware/validation.middleware.ts`)

- **Zero-Boilerplate Schema Validation**: Higher-order middleware accepting Zod schemas for `body`, `query`, and `params`.
- **Safe Type Coercion & Stripping**: Safely parses and strips unknown properties, coercing query types before reaching controllers.
- **Standardized Error Formatting**: Catches `ZodError` and transforms issues into standard `ApiResponse.error` with HTTP 400 and `VALIDATION_ERROR` code.

### 4. User Validation Schemas & DTOs (`src/modules/users/users.validation.ts`)

- **Strict Contracts**: Zod schemas for registration (`registerUserSchema`), login (`loginUserSchema`), profile updates (`updateUserSchema`), and paginated search queries (`queryUsersSchema`).
- **Normalized Data**: Automatic trimming and lowercasing on emails, strict regex enforcement for complex passwords and MongoDB `tenantId` format.
- **Static TypeScript Inferences**: Exports clean compile-time DTO types (`RegisterUserDto`, `LoginUserDto`, `UpdateUserDto`, `QueryUsersDto`) with zero `any`.
