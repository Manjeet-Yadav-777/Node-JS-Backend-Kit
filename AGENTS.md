# 🛡️ Backend Engineering Rules & Guidelines (AGENTS.md)
> **Maksad:** Is project mein koi bhi "ant-shant" ya hacky code nahi likha jayega. Har ek file, function aur variable production-grade standards ko strictly follow karega.

---

## 1. 🏛️ Architectural Rules (The 4-Layer Rule)

Is backend mein code hamesha **ek hi direction (unidirectional)** mein flow karega:
`Route ➡️ Middleware ➡️ Controller ➡️ Service ➡️ Repository/Database`

1. **Routes Layer (`*.routes.ts`):**
   - Sirf URL endpoints, HTTP methods, aur unke upar middlewares (auth, validation) define honge.
   - Koi business logic ya direct DB access nahi.

2. **Controller Layer (`*.controller.ts`):**
   - Controller ka kaam sirf **HTTP Transport** handle karna hai.
   - `req.body`, `req.params`, `req.query` se data extract karega aur Service function ko pass karega.
   - Service se return huye data ko `ApiResponse.success(res, ...)` ke through client ko bhejega.
   - ❌ **STRICT RULE:** Controller ke andar **kabhi bhi** database queries (`prisma.user.findMany`, SQL, etc.) nahi likhi jayengi.
   - ❌ **STRICT RULE:** Controller mein koi business calculations nahi hongi.

3. **Service Layer (`*.service.ts`):**
   - Sabhi business logic, calculations, aur decision making yahan hogi.
   - ❌ **STRICT RULE:** Service function ke parameters mein kabhi bhi Express ka `req` ya `res` object pass **nahi** hoga.
   - Service functions hamesha pure data inputs lenge (jaise `userId: string`, `data: RegisterUserDto`) aur pure data return karenge ya Custom Error throw karenge.
   - Isse aapki Services 100% testable aur reusable banti hain (kal ko agar Express ki jagah Fastify ya CLI command chalana ho, toh service bina kisi change ke chalegi).

4. **Repository / Database Layer (`*.repository.ts` / Prisma):**
   - Sirf Database queries aur data mutations yahan execute honge.

---

## 2. 💎 TypeScript & Type Safety (Zero 'any' Policy)

- ❌ **NO `any` ALLOWED:** Kisi bhi variable, parameter, ya return type mein `any` use karna strictly prohibited hai.
- Agar type uncertain hai toh `unknown` use karo aur type-guard lagao.
- **Zod for DTOs:** Har incoming request body, query, aur param ka Zod schema banega. TypeScript types Zod se infer honge:
  ```ts
  // ✅ Sahi tarika:
  export const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8)
  });
  export type CreateUserDto = z.infer<typeof createUserSchema>;
  ```
- **Strict Mode:** `tsconfig.json` mein `strict: true`, `noImplicitAny: true`, `strictNullChecks: true` hamesha on rahega.
- Non-null assertions (`!`) avoid karo jab tak mathematical certainty na ho.

---

## 3. 🚨 Error Handling & Response Standards

1. **Centralized Custom Errors:**
   - Har error standard custom class se throw hoga:
     - `BadRequestError (400)`
     - `UnauthorizedError (401)`
     - `ForbiddenError (403)`
     - `NotFoundError (404)`
     - `ConflictError (409)`
     - `InternalServerError (500)`
   - ❌ Controller ya Service mein empty `catch (e) {}` blocks likhna mana hai.

2. **Standard API Response Format:**
   - Har single API response is format ko follow karegi:
   ```json
   {
     "success": true,
     "statusCode": 200,
     "message": "User fetched successfully",
     "data": { ... },
     "meta": null
   }
   ```
   - Error ke case mein:
   ```json
   {
     "success": false,
     "statusCode": 400,
     "message": "Validation failed",
     "error": { "code": "VALIDATION_ERROR", "details": [ ... ] }
   }
   ```
   - Production mein internal database stack trace kabhi client ko expose nahi kiya jayega.

---

## 4. 🪵 Logging & Observability

- ❌ **NO `console.log()`:** Production code mein direct `console.log()` use karna mana hai.
- Hamesha centralized structured logger (`Pino`) use karo:
  - `logger.info(...)` - Normal flow & startup events
  - `logger.warn(...)` - Non-breaking anomalies (e.g. rate limit hit)
  - `logger.error(...)` - Failures & exceptions
- Har request ke sath unique `x-request-id` correlate hoga taaki debugging aasan ho.

---

## 5. 🔒 Security & Secrets Hygiene

- ❌ **NO HARDCODED SECRETS:** Ports, Database URLs, JWT secrets, API keys kabhi code mein hardcode nahi honge.
- Har environment variable `src/config/env.ts` mein Zod schema ke through validate hoga.
- Passwords ko hamesha **Argon2id** ya **Bcrypt (min salt rounds 12)** se hash karna hai. Plaintext passwords kabhi logs ya memory mein leak nahi hone chahiye.
- Sensitive endpoints par **Rate Limiter** aur **CORS** hamesha enabled rahega.

---

## 6. 📁 Clean Naming Conventions

| Item | Convention | Example |
| :--- | :--- | :--- |
| **Files & Folders** | `kebab-case.suffix.ts` | `auth.controller.ts`, `user.service.ts` |
| **Classes / Types / Interfaces** | `PascalCase` | `UserResponseDto`, `AuthService`, `AppError` |
| **Functions & Variables** | `camelCase` | `findUserByEmail`, `accessToken`, `hashPassword` |
| **Constants & Enums** | `UPPER_SNAKE_CASE` | `DEFAULT_PAGE_SIZE`, `USER_ROLES` |

---

## 7. 🤝 Pair Programming & Git Workflow

- Code likhne se pehle har phase ka overview clear kiya jayega.
- Har major module / milestone ke baad clean git commit kiya jayega (`feat: ...`, `fix: ...`).
- Code readable, well-commented, aur beginner-friendly maintainable hoga.
