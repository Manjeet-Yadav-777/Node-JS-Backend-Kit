# Production-Grade Reusable Backend Starter Kit

An enterprise-ready, modular, and scalable backend boilerplate designed for rapid, production-grade API development with Node.js, Express, TypeScript, MongoDB, and Redis.

---

## 1. Architectural Philosophy

This starter kit follows a **Modular Monolith** architecture with strict unidirectional flow:

```
Request -> Middlewares -> Controller -> Service -> Model / Infrastructure -> Standard Envelope
```

### Core Invariants

1. **Routes Layer (`*.routes.ts`)**: Defines URL endpoints, HTTP methods, and attaches validation/auth middlewares. Contains zero business logic.
2. **Controller Layer (`*.controller.ts`)**: Pure HTTP transport layer. Extracts data from `req.body`, `req.params`, and `req.query`, invokes the service, and sends a standardized envelope via `ApiResponse.success(res, ...)`. Never executes database queries or business calculations.
3. **Service Layer (`*.service.ts`)**: Pure domain and business logic. Accepts pure data parameters (e.g., `userId: string`, `dto: CreateUserDto`) and returns plain data objects or throws custom operational errors. Never receives Express `req` or `res` objects.
4. **Model Layer (`*.model.ts`)**: Houses Mongoose schemas, types, validation rules, and indexes. Sensitive fields (like `password` and `refreshToken`) have `select: false` enforced at schema level.
5. **Zero `any` TypeScript**: Strict type safety across all variables, inputs, outputs, and generics with Zod runtime validation.
6. **Multi-Tenancy by Default**: Built-in support for single-tenant B2C applications and multi-tenant B2B SaaS workspaces with automatic tenant context propagation.

---

## 2. Quick Start

### Prerequisites

- **Node.js**: v20+ LTS
- **npm**: v10+
- **MongoDB**: v6+ (local or MongoDB Atlas URI)
- **Redis**: v7+ (local or cloud Redis instance)

### Setup & Run

```bash
# 1. Clone repository
git clone https://github.com/Manjeet-Yadav-777/Node-JS-Backend-Kit.git
cd Node-JS-Backend-Kit

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Start local development server (with hot reload)
npm run dev

# 5. Run test suite
npm run test
```

The server starts at `http://localhost:5000` by default.

---

## 3. Developer Usage Guides & Code Examples

### 3.1 Error Handling & Standard Responses

The API uses a centralized error-handling pipeline and a standardized JSON envelope for all responses.

#### Throwing Operational Errors

Never return manual HTTP error responses in your services or business logic. Throw designated subclasses of `AppError`. The global error middleware automatically intercepts them and formats the response:

```typescript
import {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../core';

// Inside any Service or Business function:
export class OrderService {
  async getOrderById(orderId: string, tenantId: string | null) {
    const order = await OrderModel.findOne({ _id: orderId, tenantId });
    if (!order) {
      throw new NotFoundError(`Order with ID ${orderId} does not exist`);
    }
    return order;
  }

  async cancelOrder(order: OrderDocument, userId: string) {
    if (order.customerId !== userId) {
      throw new ForbiddenError('You do not have permission to cancel this order');
    }
    if (order.status === 'SHIPPED') {
      throw new ConflictError('Cannot cancel an order that has already shipped');
    }
    // Update logic...
  }
}
```

#### Sending Success Responses in Controllers

Always use `ApiResponse.success` in your controllers:

```typescript
import { Request, Response } from 'express';
import { ApiResponse } from '../../core';
import { orderService } from './order.service';

export class OrderController {
  static async getOrder(req: Request, res: Response): Promise<void> {
    const order = await orderService.getOrderById(req.params.id, req.tenantId ?? null);

    ApiResponse.success(res, order, 'Order retrieved successfully', 200);
  }

  static async listOrders(req: Request, res: Response): Promise<void> {
    const { items, pagination } = await orderService.listOrders(req.query, req.tenantId ?? null);

    ApiResponse.success(
      res,
      items,
      'Orders retrieved successfully',
      200,
      pagination, // { page: 1, limit: 10, total: 42, totalPages: 5, hasNextPage: true, hasPrevPage: false }
    );
  }
}
```

#### Standard JSON Response Envelopes

Success Envelope:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Order retrieved successfully",
  "data": {
    "id": "672465e128cb5541e4000001",
    "total": 4999,
    "status": "PROCESSING"
  },
  "meta": {
    "timestamp": "2026-11-01T10:00:00.000Z",
    "requestId": "d290f1ee-6c54-4b01-90e6-d701748f0851"
  }
}
```

Error Envelope:

```json
{
  "success": false,
  "statusCode": 404,
  "message": "Order with ID 672465e128cb5541e4000001 does not exist",
  "error": {
    "code": "NOT_FOUND",
    "details": null
  },
  "meta": {
    "timestamp": "2026-11-01T10:00:00.000Z",
    "requestId": "d290f1ee-6c54-4b01-90e6-d701748f0851"
  }
}
```

---

### 3.2 Request Validation (Zod)

Every incoming HTTP request must be validated using Zod schemas before hitting the controller.

#### Defining Schemas & DTOs (`*.validation.ts`)

```typescript
import { z } from 'zod';

export const createProductSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  price: z.number().positive('Price must be greater than zero'),
  category: z.string().trim(),
  tags: z.array(z.string()).default([]),
});

export const queryProductsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
});

// Infer static TypeScript types from schemas:
export type CreateProductDto = z.input<typeof createProductSchema>;
export type QueryProductsDto = z.infer<typeof queryProductsSchema>;
```

#### Attaching Validation Middleware (`*.routes.ts`)

```typescript
import { Router } from 'express';
import { validate } from '../../shared/middleware';
import { createProductSchema, queryProductsSchema } from './product.validation';
import { ProductController } from './product.controller';

const router = Router();

// Validate query params:
router.get('/', validate({ query: queryProductsSchema }), ProductController.listProducts);

// Validate request body:
router.post('/', validate({ body: createProductSchema }), ProductController.createProduct);

export default router;
```

---

### 3.3 Authentication, Cookies & Role-Based Access Control (RBAC)

The kit includes a dual-mode authentication system:

- **Web Applications**: Uses `httpOnly`, `secure`, `sameSite: strict` browser cookies to prevent XSS attacks.
- **Mobile / API Clients**: Supports standard `Authorization: Bearer <token>` headers.

#### Protecting Routes with `authenticate` & `authorize`

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '../../shared/middleware';
import { USER_ROLES } from '../../core';
import { AdminController } from './admin.controller';

const router = Router();

// 1. Any authenticated user:
router.get('/profile', authenticate, AdminController.getProfile);

// 2. Restricted to ADMIN role only:
router.delete('/users/:id', authenticate, authorize(USER_ROLES.ADMIN), AdminController.deleteUser);

// 3. Restricted to multiple roles:
router.patch(
  '/settings',
  authenticate,
  authorize(USER_ROLES.ADMIN, 'super_admin'),
  AdminController.updateSettings,
);

export default router;
```

#### Accessing Authenticated User Context

In controllers or route handlers, access the strongly typed `req.user` directly:

```typescript
export class ProfileController {
  static async getProfile(req: Request, res: Response): Promise<void> {
    // req.user is guaranteed to exist when route is protected by `authenticate`:
    const { userId, role, tenantId } = req.user!;

    const user = await usersService.getUserById(userId, tenantId);
    ApiResponse.success(res, user, 'Profile fetched successfully');
  }
}
```

#### Password Reset Flow (Asynchronous Background Email)

1. **Request Password Reset Link (`POST /api/v1/auth/forgot-password`)**:
   - Request body: `{ "email": "user@example.com" }`.
   - Generates a cryptographically secure 32-byte unguessable token, stores its SHA-256 hash in MongoDB with a 15-minute expiration.
   - Dispatches an asynchronous `send-password-reset` job to the BullMQ background queue without blocking the HTTP response.
   - Always returns a generic success message to prevent user enumeration attacks.

2. **Reset Password with Token (`POST /api/v1/auth/reset-password`)**:
   - Request body: `{ "token": "<token_from_email>", "password": "NewSecurePassword123" }`.
   - Validates token against SHA-256 hash and checks expiration.
   - Re-hashes new password with bcrypt (10 salt rounds).
   - Clears existing reset token and invalidates active refresh tokens to force re-authentication.

---

### 3.4 Multi-Tenancy Architecture (B2B SaaS Ready)

The kit supports automatic multi-tenant context extraction without requiring manual parameter passing:

1. **Pre-Authentication / Public Calls**: The client sends the tenant identifier in the `x-tenant-id` HTTP header.
2. **Post-Authentication**: The JWT token contains the user's `tenantId`. The `authenticate` middleware automatically extracts it and binds it to `req.tenantId` and the `x-tenant-id` response header.

#### Querying Database in a Multi-Tenant Context

Always scope database queries using `req.tenantId`:

```typescript
export class DocumentService {
  async listDocuments(tenantId: string | null) {
    const filter: Record<string, unknown> = {};
    if (tenantId) {
      filter.tenantId = tenantId;
    }

    return DocumentModel.find(filter).lean();
  }
}
```

---

### 3.5 Redis Cache & Connection Management

The starter kit provides a high-level, fail-open `cacheService` alongside the direct `ioredis` client with automatic exponential backoff reconnection and graceful shutdown.

#### Using Type-Safe Cache-Aside (`cacheService`)

```typescript
import { cacheService } from '../infrastructure';

export class ProductService {
  async getProductById(id: string): Promise<Product> {
    // 1. Automatic cache-aside with remember():
    // If cached in Redis, returns immediately.
    // Otherwise runs the factory function, sets TTL in seconds, and returns fresh data:
    return cacheService.remember(`product:${id}`, 3600, async () => {
      const product = await ProductModel.findById(id).lean();
      if (!product) {
        throw new NotFoundError(`Product ${id} not found`);
      }
      return product;
    });
  }

  async updateProduct(id: string, updateDto: UpdateProductDto): Promise<Product> {
    const updated = await ProductModel.findByIdAndUpdate(id, updateDto, { new: true });

    // 2. Invalidate single or multiple keys:
    await cacheService.del(`product:${id}`);

    // 3. Invalidate an entire pattern or category:
    await cacheService.deleteByPattern('products:list:*');

    return updated;
  }
}
```

#### Distributed Locking (`lockService`)

A distributed lock guarantees that only **one server instance** across your entire cluster can execute a critical section of code at any given time.

##### Why is it needed?

In production, your backend runs across multiple Docker containers or cloud instances. If two identical requests hit two different server instances at the exact same millisecond (e.g. user double-clicking "Pay Now" or two users booking the last concert seat), standard Node.js in-memory locks cannot prevent race conditions. Redis acts as a centralized coordinator.

##### When to use it:

- **Payment Processing**: Prevent duplicate charges when users double-click or network retries occur.
- **Inventory / Stock Deduction**: Prevent overselling limited items in high-traffic flash sales.
- **Multi-Instance Cron Tasks**: Ensure a scheduled task runs exactly once, even when 5 server instances are running.
- **Financial Balance & Wallet Transfers**: Prevent concurrent balance deductions (double-spending attacks).
- **Seat / Booking Reservations**: Lock a specific seat ID while the user completes payment.

##### When NOT to use it:

- Normal `GET` or read-only requests.
- Operations already protected by MongoDB unique indexes (e.g. registering with a unique email).
- High-frequency low-risk telemetry/analytics (use atomic counters `client.incr` instead).

##### Code Example:

```typescript
import { lockService } from '../infrastructure';

export class OrderService {
  async processPayment(orderId: string, amount: number) {
    // Automatically acquires lock, executes task, and safely releases lock via Lua script:
    return lockService.withLock(
      `order:payment:${orderId}`,
      async () => {
        // Critical Section: Guaranteed to run exclusively across the entire cluster
        return paymentGateway.charge(orderId, amount);
      },
      {
        ttlMs: 5000, // Lock automatically expires after 5s if server crashes
        retries: 3, // Retry up to 3 times if another instance currently holds the lock
        retryDelayMs: 150, // Wait 150ms between retry attempts
      },
    );
  }
}
```

##### How It Works Internally:

1. **Atomic Acquisition**: Uses Redis `SET lock:<key> <token> PX <ttl> NX` ("NX" = only set if key does not exist).
2. **Cryptographic Token Ownership**: Generates a unique UUID token per acquisition.
3. **Safe Lua Release**: Uses an atomic Lua script to verify token identity before deleting. This prevents a worker from deleting another worker's lock if its own execution exceeded the TTL.
4. **Fail-Safe Cleanup**: The `withLock` wrapper guarantees release in a `finally` block even if the task throws an unhandled error.

#### Sliding-Window Rate Limiting (`rateLimiter`)

Protect endpoints against brute-force attacks, credential stuffing, and API flooding using Redis atomic sliding-window pipelines:

```typescript
import { Router } from 'express';
import { rateLimiter } from '../shared';

const router = Router();

// 1. Strict limiter for authentication / sensitive endpoints (5 attempts per 15 min):
const authLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again after 15 minutes',
  keyPrefix: 'auth_login',
});

router.post('/login', authLimiter, AuthController.login);

// 2. High-throughput API limiter (e.g. 100 requests per minute):
const apiLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  keyPrefix: 'api_general',
});
```

- **Standards-Compliant Headers**: Injects `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` into HTTP response headers.
- **Fail-Open Reliability**: If Redis is unreachable, requests are permitted without crashing the API.
- **Standard HTTP 429 Envelope**: Exceeding the quota dispatches a standardized `ApiResponse.error` with a `Retry-After` header.

#### Raw Client & Health Probes

```typescript
import { getRedisClient, isRedisConnected } from '../infrastructure';

// Direct ioredis client access for atomic counters, pipelines, or raw commands:
if (isRedisConnected()) {
  const client = getRedisClient();
  await client.incr('analytics:pageviews');
}
```

#### System Health Check Endpoint

Call `GET /healthz` to inspect real-time service health:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Service health report",
  "data": {
    "status": "healthy",
    "timestamp": "2026-11-01T10:00:00.000Z",
    "uptime": 124.5,
    "environment": "development",
    "services": {
      "database": "connected",
      "redis": "connected"
    }
  }
}
```

---

### 3.6 Background Job Queues & Producers (BullMQ)

The kit provides an enterprise-ready background job producer via `queueManager`. It maintains dedicated Redis connections (with `maxRetriesPerRequest: null` required for BullMQ blocking commands), automated exponential backoff retries, and job retention policies.

#### Adding a Single Background Job

```typescript
import { queueManager } from '../infrastructure';

// Adds job with default 3 retry attempts, exponential backoff, and automatic cleanup:
await queueManager.addJob('email-queue', 'send-welcome-email', {
  to: 'user@example.com',
  template: 'welcome',
  userId: 'user_123',
});
```

#### Delayed and Prioritized Jobs

```typescript
// Add a job that executes after 60 seconds with elevated priority (1 = highest):
await queueManager.addJob(
  'notification-queue',
  'send-reminder',
  { userId: 'user_123', reminderText: 'Your subscription is expiring soon' },
  {
    delay: 60 * 1000, // 60 seconds
    priority: 1, // High priority
    attempts: 5, // Override retry count
  },
);
```

#### High-Throughput Batch Publishing

```typescript
// Enqueue hundreds or thousands of jobs in a single Redis atomic pipeline:
await queueManager.addBulkJobs('email-queue', [
  { name: 'send-digest', data: { to: 'alex@example.com', digestId: 'd1' } },
  { name: 'send-digest', data: { to: 'sam@example.com', digestId: 'd1' } },
  { name: 'send-digest', data: { to: 'taylor@example.com', digestId: 'd1' } },
]);
```

#### Consuming Jobs with `workerManager`

Workers process background jobs concurrently with automated lifecycle event logging (`completed`, `failed`, `stalled`, `error`):

```typescript
import { workerManager } from '../infrastructure';

// Register a consumer worker for the 'email-queue' with concurrency of 5:
workerManager.registerWorker(
  'email-queue',
  async (job) => {
    // Pure data access from job.data:
    const { to, template, userId } = job.data;
    await sendEmail({ to, template, userId });
    return { delivered: true, sentAt: new Date() };
  },
  { concurrency: 5 },
);
```

> [!NOTE]
> All workers registered via `workerManager` are automatically stopped and drained during graceful shutdown before HTTP server and database connections terminate.

#### Reusable Domain Job Processors (`src/jobs/`)

The starter kit organizes queue consumers into dedicated job modules in `src/jobs/` with strongly-typed payloads and helper dispatchers:

```typescript
import {
  enqueueWelcomeEmail,
  enqueuePasswordResetEmail,
  enqueueOtpEmail,
  startEmailWorker,
} from '../jobs';

// 1. Dispatching a typed welcome email:
await enqueueWelcomeEmail({
  to: 'user@example.com',
  name: 'Alex',
  userId: 'usr_123',
});

// 2. Dispatching a password reset email with priority override:
await enqueuePasswordResetEmail(
  {
    to: 'user@example.com',
    resetToken: 'secure_token_xyz',
    expiresInMinutes: 15,
  },
  { priority: 1 },
);

// 3. Dispatching an OTP verification email:
await enqueueOtpEmail({
  to: 'user@example.com',
  otp: '739201',
  name: 'Alex',
  purpose: 'login verification',
  expiresInMinutes: 10,
});

// 4. Bootstrapping background email worker:
startEmailWorker(5); // Concurrency of 5 workers
```

#### Responsive HTML Email Templates (`src/infrastructure/email/templates/`)

Email templates are decoupled from queue producers and HTTP controllers. Rather than bloating Redis memory with huge HTML strings, jobs transmit lightweight JSON parameters, and background workers compile the final responsive HTML on-demand:

- **Welcome Email** (`renderWelcomeEmail`): Clean onboarding card with dynamic dashboard CTA button and support link.
- **Password Reset Email** (`renderPasswordResetEmail`): Security-styled card featuring direct password reset CTA, raw token fallback, expiration warning (15m default), and fraud contact notice.
- **OTP Verification Email** (`renderOtpEmail`): High-contrast card with formatted verification code badge, expiry notice, security alert, and custom purpose context.

```typescript
import { renderWelcomeEmail, renderPasswordResetEmail, renderOtpEmail } from '../infrastructure';

// 1. Render Welcome Email HTML:
const welcomeHtml = renderWelcomeEmail({
  name: 'Alex',
  loginUrl: 'https://myapp.com/login',
});

// 2. Render Password Reset Email HTML:
const resetHtml = renderPasswordResetEmail({
  resetToken: 'token_123',
  resetUrl: 'https://myapp.com/reset-password?token=token_123',
  expiresInMinutes: 15,
});

// 3. Render OTP Verification Email HTML:
const otpHtml = renderOtpEmail({
  otp: '849201',
  name: 'Alex',
  purpose: 'two-factor authentication',
  expiresInMinutes: 10,
});
```

#### Email Provider Service & SMTP Dispatcher (`src/infrastructure/email/email.service.ts`)

The kit integrates Nodemailer with an automatic environment-aware transport:

- **Production / Staging**: Connects to your configured SMTP server (Gmail, SendGrid, Amazon SES, Mailgun, Postmark, etc.) when `SMTP_HOST` and `SMTP_USER` are configured in `.env`.
- **Local Development & Testing**: Automatically falls back to a non-blocking `jsonTransport` if SMTP credentials are not configured. Emails are captured and logged with mock message IDs, preventing development blockers and test timeouts.

```typescript
import { emailService } from '../infrastructure';

// Direct email dispatch (or automatically via BullMQ email workers):
const result = await emailService.sendEmail({
  to: 'customer@example.com',
  subject: 'Welcome to Our Service',
  html: '<h1>Welcome!</h1><p>Thank you for signing up.</p>',
});

console.log('Dispatched message ID:', result.messageId);
```

##### SMTP Environment Variables

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_smtp_user@example.com
SMTP_PASS=your_smtp_password
SMTP_SECURE=false
EMAIL_FROM="MyApp Support <support@myapp.com>"
```

---

### 3.7 Storage Provider Abstraction (`src/infrastructure/storage/`)

All file persistence follows the Provider Adapter pattern (`IStorageProvider`), ensuring that file upload logic in controllers and services remains completely decoupled from physical storage providers (Local disk, AWS S3, Cloudflare R2, Google Cloud Storage, or MinIO).

#### Interface Contract (`IStorageProvider`)

```typescript
import { IStorageProvider, StorageFile, UploadResult } from '../infrastructure';

export interface IStorageProvider {
  upload(file: StorageFile, options?: UploadOptions): Promise<UploadResult>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  exists(key: string): Promise<boolean>;
}
```

---

### 3.8 Step-by-Step Tutorial: How to Add a New Domain Module

Follow these steps to create a new module (for example: `orders`):

#### Step 1: Create Model (`src/modules/orders/orders.model.ts`)

```typescript
import { Schema, model, Document } from 'mongoose';

export interface IOrder extends Document {
  tenantId?: Schema.Types.ObjectId;
  customerId: string;
  total: number;
  status: string;
}

const orderSchema = new Schema<IOrder>(
  {
    tenantId: { type: Schema.Types.ObjectId, index: true },
    customerId: { type: String, required: true, index: true },
    total: { type: Number, required: true },
    status: { type: String, default: 'PENDING' },
  },
  { timestamps: true },
);

export const OrderModel = model<IOrder>('Order', orderSchema);
```

#### Step 2: Create Validation Schemas (`src/modules/orders/orders.validation.ts`)

```typescript
import { z } from 'zod';

export const createOrderSchema = z.object({
  customerId: z.string().trim().min(1),
  total: z.number().positive(),
});

export type CreateOrderDto = z.input<typeof createOrderSchema>;
```

#### Step 3: Create Service (`src/modules/orders/orders.service.ts`)

```typescript
import { OrderModel } from './orders.model';
import { CreateOrderDto } from './orders.validation';
import { NotFoundError } from '../../core';

export class OrdersService {
  async createOrder(dto: CreateOrderDto, tenantId?: string | null) {
    return OrderModel.create({ ...dto, tenantId });
  }

  async getOrderById(id: string, tenantId?: string | null) {
    const order = await OrderModel.findOne({ _id: id, ...(tenantId && { tenantId }) });
    if (!order) {
      throw new NotFoundError(`Order ${id} not found`);
    }
    return order;
  }
}

export const ordersService = new OrdersService();
```

#### Step 4: Create Controller (`src/modules/orders/orders.controller.ts`)

```typescript
import { Request, Response } from 'express';
import { ordersService } from './orders.service';
import { ApiResponse } from '../../core';

export class OrdersController {
  static async createOrder(req: Request, res: Response): Promise<void> {
    const order = await ordersService.createOrder(req.body, req.tenantId);
    ApiResponse.success(res, order, 'Order created successfully', 201);
  }

  static async getOrder(req: Request, res: Response): Promise<void> {
    const order = await ordersService.getOrderById(req.params.id, req.tenantId);
    ApiResponse.success(res, order, 'Order retrieved successfully', 200);
  }
}
```

#### Step 5: Create Routes (`src/modules/orders/orders.routes.ts`)

```typescript
import { Router } from 'express';
import { OrdersController } from './orders.controller';
import { authenticate, validate } from '../../shared/middleware';
import { createOrderSchema } from './orders.validation';

const router = Router();

router.use(authenticate);
router.post('/', validate({ body: createOrderSchema }), OrdersController.createOrder);
router.get('/:id', OrdersController.getOrder);

export default router;
```

#### Step 6: Create Barrel Export & Mount in `src/app.ts`

In `src/modules/orders/index.ts`:

```typescript
export { default as orderRoutes } from './orders.routes';
export * from './orders.service';
export * from './orders.model';
```

In `src/app.ts`:

```typescript
import orderRoutes from './modules/orders/orders.routes';

// Inside createApp():
app.use('/api/v1/orders', orderRoutes);
```

---

## 4. Project Structure

```
backend/
├── src/
│   ├── app.ts                          # Express application factory
│   ├── server.ts                       # Server bootstrap and graceful shutdown
│   ├── config/                         # Unified configuration and environment validation
│   ├── core/                           # Framework-agnostic foundation (errors, responses, types)
│   ├── infrastructure/                 # External service clients (MongoDB, Redis, Kafka)
│   │   ├── cache/                      # Redis connection and caching utilities
│   │   └── database/                   # MongoDB Mongoose connection
│   ├── shared/                         # Middlewares (auth, tenant, validation, rbac, error)
│   ├── modules/                        # Domain feature modules (auth, users, health)
│   ├── jobs/                           # Background queue processors
│   ├── events/                         # Event-driven publishers and consumers
│   └── docs/                           # OpenAPI documentation
├── tests/                              # Unit, integration, and E2E test suites
│   └── unit/
│       ├── auth/                       # Auth domain tests
│       ├── cache/                      # Cache & Redis unit tests
│       ├── core/                       # Core utility tests
│       ├── shared/                     # Shared middleware tests
│       └── users/                      # User domain tests
├── .env.example                        # Example environment variables template
├── package.json                        # Dependencies and scripts
├── tsconfig.json                       # Strict TypeScript configuration
└── PRD.md                              # Complete product checklist and implementation phases
```

---

## 5. Environment Variables Reference

| Variable                 | Description                                                   | Required | Default                  |
| :----------------------- | :------------------------------------------------------------ | :------- | :----------------------- |
| `NODE_ENV`               | Application environment (`development`, `test`, `production`) | No       | `development`            |
| `PORT`                   | HTTP server listening port                                    | No       | `5000`                   |
| `API_PREFIX`             | Base path for REST API routes                                 | No       | `/api/v1`                |
| `MONGODB_URI`            | MongoDB connection connection string                          | Yes      | -                        |
| `REDIS_URL`              | Redis connection URL                                          | No       | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET`      | Secret key used for signing Access Tokens                     | Yes      | -                        |
| `JWT_REFRESH_SECRET`     | Secret key used for signing Refresh Tokens                    | Yes      | -                        |
| `JWT_ACCESS_EXPIRES_IN`  | Access token lifespan string (e.g. `15m`)                     | No       | `15m`                    |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan string (e.g. `7d`)                     | No       | `7d`                     |
| `LOG_LEVEL`              | Pino log level (`trace`, `debug`, `info`, `warn`, `error`)    | No       | `info`                   |

---

## 6. Available Scripts

| Script              | Purpose                                                               |
| :------------------ | :-------------------------------------------------------------------- |
| `npm run dev`       | Runs application in development mode with hot reload                  |
| `npm run build`     | Compiles TypeScript into distribution JavaScript (`dist/`)            |
| `npm start`         | Executes the compiled production build from `dist/server.js`          |
| `npm run test`      | Executes the complete Vitest test suite                               |
| `npm run typecheck` | Validates TypeScript types across the entire project (`tsc --noEmit`) |
| `npm run lint`      | Inspects code for style and syntax consistency with ESLint            |
| `npm run format`    | Enforces code formatting rules across the codebase using Prettier     |

---

## 7. Roadmap & Product Specifications

Detailed project milestones, checklist items, and architectural requirements are tracked in [PRD.md](file:///Users/manjeetyadav/Desktop/Backend/PRD.md).
