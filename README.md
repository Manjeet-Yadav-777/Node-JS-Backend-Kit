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
- [x] **Phase 2:** MongoDB + Mongoose Integration, Models, Validation
- [x] **Phase 3:** Authentication (JWT, Refresh Tokens, Cookies), RBAC, Security _(In Progress)_
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

### 5. User Domain Service (`src/modules/users/users.service.ts`)

- **Pure Business Logic Layer**: Fully decoupled from HTTP transport (never touches Express `req`/`res`).
- **Cryptographic Security**: Hashes user passwords using `bcryptjs` with standard 12 salt rounds before persisting.
- **Multi-Tenant Isolation**: Enforces tenant boundary scoping on queries (`_id`, `tenantId`) and validates ObjectId formats.
- **Domain Operations**: Provides `createUser`, `getUserById`, `getUserByEmail`, `getUserWithPasswordByEmail`, `updateUser`, and paginated `listUsers`.

### 6. User Controller Layer (`src/modules/users/users.controller.ts`)

- **Strict Transport Decoupling**: Extracts request payload (`body`, `params`, `query`, `tenantId`) and delegates directly to `usersService`.
- **Zero Business Logic In Controllers**: Contains zero database queries or calculations; handles only HTTP marshalling and error forwarding.
- **Standardized Responses**: Dispatches clean envelopes using `ApiResponse.success` with HTTP status codes and pagination metadata.

### 7. User Routes Layer (`src/modules/users/users.routes.ts`)

- **Declarative Route Mapping**: Binds endpoints under `/api/v1/users` cleanly without business logic.
- **Pre-Controller Validation Guards**:
  - `POST /api/v1/users`: Validated with `registerUserSchema` -> `UsersController.createUser` (HTTP 201).
  - `GET /api/v1/users`: Validated with `queryUsersSchema` -> `UsersController.listUsers` (HTTP 200).
  - `GET /api/v1/users/:id`: -> `UsersController.getUserById` (HTTP 200).
  - `PATCH /api/v1/users/:id`: Validated with `updateUserSchema` -> `UsersController.updateUser` (HTTP 200).

### 8. JWT Token Utility (`src/core/utils/jwt.util.ts`)

- **Enterprise Token Lifecycle**: Handles signing and verification for short-lived Access Tokens (`15m`) and long-lived Refresh Tokens (`7d`).
- **Embedded Multi-Tenant Payload**: Cryptographically embeds `userId`, `role`, and `tenantId` in the JWT payload, enabling automatic downstream tenant binding without manual client headers.
- **Fail-Safe Verification**: Automatically catches `TokenExpiredError` or signature tampering and throws designated `UnauthorizedError` instances handled by the global error middleware.

### 9. Authentication Guard Middleware (`src/shared/middleware/auth.middleware.ts`)

- **Bearer Token Extraction**: Extracts and validates the `Authorization: Bearer <token>` header, rejecting missing or malformed tokens with standard `UnauthorizedError` (HTTP 401).
- **Strong Request Context Injection**: Verifies token validity with `JwtUtil` and injects `req.user` (`userId`, `role`, `tenantId`) into the globally typed Express request context.
- **Automatic Multi-Tenant Binding**: If the authenticated user's JWT payload contains a `tenantId`, it automatically binds `req.tenantId` and sets the `x-tenant-id` response header, relieving frontend clients from manually injecting tenant headers on authenticated requests.

### 10. Role-Based Access Control (RBAC) Guard (`src/shared/middleware/rbac.middleware.ts`)

- **Declarative Route Protection**: Higher-order middleware `authorize(...allowedRoles)` guarding endpoints based on authenticated caller roles (e.g. `authorize(USER_ROLES.ADMIN)`).
- **Access Enforcement**: Rejects unauthenticated callers with HTTP 401 `UnauthorizedError` and unauthorized roles with HTTP 403 `ForbiddenError`.

### 11. Authentication Domain Service (`src/modules/auth/auth.service.ts`)

- **User Registration & Token Issuance**: Delegates account creation to `usersService`, hashes generated refresh token, and saves hash to MongoDB.
- **Timing-Safe Login Verification**: Employs constant-time `bcryptjs` password comparison, avoiding user enumeration vectors.
- **Cryptographic Token Rotation**: Rotates both Access & Refresh tokens on each refresh call, automatically revoking compromised sessions if token reuse is detected.
- **Secure Logout**: Invalidates server-side refresh tokens by unsetting stored hash.

### 12. Authentication Controller & httpOnly Cookie Strategy (`src/modules/auth/auth.controller.ts`)

- **XSS-Resistant Cookie Management**: Issues `accessToken` and `refreshToken` in `httpOnly, secure, sameSite` cookies, completely isolating tokens from client-side JavaScript access.
- **Dual Client Transport**: Returns tokens in JSON body for mobile apps/Postman while setting cookies for web browsers.
- **Endpoint Operations**:
  - `register`: Creates account, sets session cookies, returns HTTP 201.
  - `login`: Validates credentials, sets session cookies, returns HTTP 200.
  - `refreshToken`: Reads from cookie or body, executes cryptographic rotation, updates cookies.
  - `logout`: Unsets DB session and clears browser cookies.
  - `getMe`: Resolves authenticated profile for the current session.
