# Backend Engineering Rules and Operating Guidelines

## 1. Operating and Agent Behavioral Constraints

1. **Rule Precedence:** Review and strictly follow all rules defined in this file before executing any task or writing code.
2. **Concise Communication:** Keep explanations concise. Do not overdescribe concepts or add unnecessary conversational bloat.
3. **No Unnecessary Complexity:** Keep implementations clean, simple, and pragmatic. Avoid premature abstractions and over-engineering.
4. **Safety and Deletion Permissions:** Never drop tables, truncate collections, or delete database records without explicit user confirmation.
5. **Workspace Boundary:** Do not read, write, or access any files or directories outside this project repository (`/Users/manjeetyadav/Desktop/Backend`) without explicit permission.
6. **No Emojis in Code:** Do not use emojis in code files, log statements, comments, or git commit messages.
7. **Minimal and Meaningful Comments:**
   - Do not comment line-by-line or explain trivial code.
   - Add comments only where complex business logic, security decisions, or non-obvious workarounds exist.
   - All code comments must be short, clear, and written in English.
8. **Strict Code Reuse (DRY):** Always inspect existing files, utilities, schemas, and helpers before creating new ones. Never duplicate functionality.
9. **Language Policy:**
   - All code, files, documentation, commit messages, and comments must be strictly in English.
   - Conversational discussion with the user may use Hindi/Hinglish as requested.

---

## 2. Architectural Rules (The 4-Layer Rule)

All application code must flow unidirectionally:
`Route -> Middleware -> Controller -> Service -> Repository/Database`

1. **Routes Layer (`*.routes.ts`):**
   - Define only URL endpoints, HTTP methods, and attached middlewares (auth, validation).
   - No business logic or database interactions allowed.

2. **Controller Layer (`*.controller.ts`):**
   - Handles HTTP transport only.
   - Extracts data from `req.body`, `req.params`, and `req.query`, and delegates execution to the corresponding Service method.
   - Dispatches standardized responses using `ApiResponse.success(res, ...)`.
   - Never write database queries (Mongoose/MongoDB) inside controllers.
   - Never perform business calculations inside controllers.

3. **Service Layer (`*.service.ts`):**
   - Houses all business logic, data transformation, calculations, and orchestration.
   - Never pass Express `req` or `res` objects into service methods.
   - Service methods must accept pure data parameters (e.g., `userId: string`, `dto: CreateUserDto`) and return pure data or throw custom error instances.

4. **Repository / Database Layer (`*.repository.ts` / Mongoose Models):**
   - Executes database operations, data persistence, and query building.

---

## 3. TypeScript and Type Safety (Zero 'any' Policy)

- The `any` type is strictly forbidden across variables, parameters, and return types.
- If a type is uncertain, use `unknown` with runtime type narrowing.
- All request payloads (body, query, params) must be defined with Zod schemas, and TypeScript types must be inferred:
  ```ts
  export const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });
  export type CreateUserDto = z.infer<typeof createUserSchema>;
  ```
- Strict mode settings (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`) must remain enabled.
- Avoid non-null assertions (`!`) unless mathematically proven and guaranteed.

---

## 4. Error Handling and Response Standards

1. **Centralized Custom Errors:**
   - Errors must be thrown using designated custom classes extending a base `AppError`:
     - `BadRequestError (400)`
     - `UnauthorizedError (401)`
     - `ForbiddenError (403)`
     - `NotFoundError (404)`
     - `ConflictError (409)`
     - `InternalServerError (500)`
   - Empty `catch (error) {}` blocks are strictly prohibited.

2. **Consistent Response Envelope:**
   - Success format:
     ```json
     {
       "success": true,
       "statusCode": 200,
       "message": "Resource fetched successfully",
       "data": { ... },
       "meta": null
     }
     ```
   - Error format:
     ```json
     {
       "success": false,
       "statusCode": 400,
       "message": "Validation failed",
       "error": { "code": "VALIDATION_ERROR", "details": [ ... ] }
     }
     ```
   - Never expose internal database stack traces or raw errors in production responses.

---

## 5. Logging and Observability

- Do not use `console.log()` in application code.
- Use a centralized structured logger (Pino):
  - `logger.info(...)`: Application startup, lifecycle events, state transitions.
  - `logger.warn(...)`: Non-critical warnings, rate-limit warnings.
  - `logger.error(...)`: Unhandled exceptions, failed third-party integrations.
- Attach a unique `x-request-id` to every incoming request for tracing.

---

## 6. Security and Configuration Hygiene

- Never hardcode secrets, ports, database credentials, or API keys.
- All environment variables must be validated at startup via Zod in `src/config/env.ts`.
- Passwords must be hashed using Argon2id or Bcrypt (minimum 12 rounds).
- Sensitive routes must implement rate limiting and CORS protection.

---

## 7. Naming Conventions

| Identifier                       | Convention             | Example                                          |
| :------------------------------- | :--------------------- | :----------------------------------------------- |
| **Files and Folders**            | `kebab-case.suffix.ts` | `auth.controller.ts`, `user.service.ts`          |
| **Classes / Types / Interfaces** | `PascalCase`           | `UserResponseDto`, `AuthService`, `AppError`     |
| **Functions and Variables**      | `camelCase`            | `findUserByEmail`, `accessToken`, `hashPassword` |
| **Constants and Enums**          | `UPPER_SNAKE_CASE`     | `DEFAULT_PAGE_SIZE`, `USER_ROLES`                |
