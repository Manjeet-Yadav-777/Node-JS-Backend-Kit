# Backend Engineering Rules and Operating Guidelines

## 1. Operating and Agent Behavioral Constraints

1. **Rule Precedence:** Review and strictly follow all rules defined in this file before executing any task or writing code.
2. **Step-by-Step Execution:** Do not build everything at once. Build modularly, phase by phase, allowing the user to review, test, and understand each component before moving to the next.
3. **Living README Documentation:** Continuously update `README.md` with every newly implemented system, including usage guides, code snippets, and environment variable requirements.
4. **Concise Communication:** Keep conversational explanations clear, relatable, and concise. Avoid unnecessary conversational bloat.
5. **No Unnecessary Complexity:** Keep implementations clean, simple, and pragmatic. Avoid premature abstractions and over-engineering.
6. **Safety and Deletion Permissions:** Never drop collections or delete database records without explicit user confirmation.
7. **Workspace Boundary:** Do not read, write, or access any files or directories outside this project repository (`/Users/manjeetyadav/Desktop/Backend`) without explicit permission.
8. **No Emojis in Code:** Do not use emojis in code files, log statements, comments, or git commit messages.
9. **Minimal and Meaningful Comments:**
   - Do not comment line-by-line or explain trivial code.
   - Add comments only where complex business logic, security decisions, or non-obvious workarounds exist.
   - All code comments must be short, clear, and written in English.
10. **Strict Code Reuse (DRY):** Always inspect existing files, utilities, schemas, and helpers before creating new ones. Never duplicate functionality.
11. **Barrel Export Pattern (`index.ts`):** Every module, subfolder, and utility directory must maintain an `index.ts` file exporting public functions, classes, and types.
12. **Language Policy:**

- All code, files, documentation, commit messages, and comments must be strictly in English.
- Conversational discussion with the user may use Hindi/Hinglish as requested.

---

## 2. Architectural Rules (Modular Monolith)

All application code flows unidirectionally:
`Route -> Middleware -> Controller -> Service -> Model / Infrastructure`

1. **Routes Layer (`*.routes.ts`):**
   - Define only URL endpoints, HTTP methods, and attached middlewares (auth, validation, rate limits).
   - No business logic or database interactions allowed.

2. **Controller Layer (`*.controller.ts`):**
   - Handles HTTP transport only.
   - Extracts data from `req.body`, `req.params`, and `req.query`, and delegates execution to the corresponding Service method.
   - Dispatches standardized responses using `ApiResponse.success(res, ...)`.
   - Never write database queries inside controllers.
   - Never perform business calculations inside controllers.

3. **Service Layer (`*.service.ts`):**
   - Houses all business logic, data transformation, calculations, and database queries.
   - Never pass Express `req` or `res` objects into service methods.
   - Service methods must accept pure data parameters (e.g., `userId: string`, `dto: CreateUserDto`) and return pure data or throw custom error instances.

4. **Model Layer (`*.model.ts`):**
   - Defines Mongoose schemas, types, validation rules, and indexes.

5. **Optional Repository Layer (`*.repository.ts`):**
   - Use only when complex MongoDB aggregation pipelines or multi-collection joins justify data abstraction. Do not create pass-through wrappers for basic CRUD.

---

## 3. TypeScript and Type Safety (Zero 'any' Policy)

- The `any` type is strictly forbidden across variables, parameters, and return types.
- If a type is uncertain, use `unknown` with runtime type narrowing.
- All request payloads (body, query, params) must be defined with Zod schemas, and TypeScript types must be inferred.
- Strict mode settings (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`) must remain enabled.

---

## 4. Error Handling and Response Standards

1. **Centralized Custom Errors:**
   - Errors must be thrown using designated custom classes extending a base `AppError`.
   - Empty `catch (error) {}` blocks are strictly prohibited.

2. **Consistent Response Envelope:**
   - Every single API endpoint must return a standard `ApiResponse` envelope with `success`, `statusCode`, `message`, `data`, and `meta`.
