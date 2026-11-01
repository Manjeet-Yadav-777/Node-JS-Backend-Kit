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

#### Raw Client & Health Probes

```typescript
import { getRedisClient, isRedisConnected } from '../infrastructure';

// Direct ioredis client access for atomic counters, pipelines, or locks:
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

### 3.6 Step-by-Step Tutorial: How to Add a New Domain Module

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
