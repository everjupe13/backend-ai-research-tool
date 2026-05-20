# AI Research Tool — Backend

## Project overview

NestJS backend for an AI-powered research tool. Users submit a research topic, the system searches OpenSearch, summarizes results via AI APIs, and stores reports in PostgreSQL. PDF export is gated behind Stripe subscriptions.

---

## Tech stack

### Core
- **Runtime**: Node.js 20+
- **Framework**: NestJS 10 with TypeScript (strict mode)
- **Package manager**: npm

### Database
- **PostgreSQL 15** — primary data store
- **TypeORM** — ORM, migrations, repositories
- All schema changes go through migrations (`npm run migration:generate`, `npm run migration:run`)
- Never use `synchronize: true` in production

### Queue & cache
- **Redis 7** — backing store for BullMQ and response caching
- **BullMQ** — async job queue for report generation
- Queue names: `research` (main), `export` (PDF generation)
- All heavy or long-running operations go through BullMQ, never inline in a request handler

### Search
- **OpenSearch 2** — full-text search over accumulated topic data
- Index name convention: `research-{env}` (e.g. `research-dev`, `research-prod`)
- Use the `@opensearch-project/opensearch` client

### Payments
- **Stripe** — subscription management for paid PDF export
- Webhook endpoint: `POST /webhooks/stripe`
- Always verify webhook signature with `stripe.webhooks.constructEvent`
- Subscription plans stored in the `subscriptions` table

### AI integrations
- **Anthropic Claude** (`@anthropic-ai/sdk`) — primary summarization model
- **OpenAI** (`openai`) — fallback or comparison use cases
- All AI calls go through a dedicated `AiService` — never call SDKs directly from controllers or workers
- Use streaming responses where possible for long summarizations

### Auth
- JWT-based auth with `@nestjs/jwt` and `@nestjs/passport`
- Access token: 15 min TTL
- Refresh token: 7 days TTL, stored in `refresh_tokens` table
- Guards: `JwtAuthGuard` (global default), `SubscriptionGuard` (paid features)
- `@Public()` decorator bypasses `JwtAuthGuard` on any route
- `@CurrentUser()` param decorator extracts the authenticated user from the request

#### Auth module structure

```
src/modules/auth/
├── dto/
│   ├── register.dto.ts     # email, password (min 8 chars)
│   ├── login.dto.ts        # email, password
│   └── refresh.dto.ts      # refreshToken
├── entities/
│   └── refresh-token.entity.ts  # id, token, expiresAt, userId → users
├── guards/
│   └── jwt-auth.guard.ts   # extends AuthGuard('jwt'), respects @Public()
├── strategies/
│   └── jwt.strategy.ts     # validates JWT, loads user from DB
├── auth.controller.ts      # POST /api/v1/auth/register|login|refresh
├── auth.service.ts         # register, login, refresh, issueTokens
└── auth.module.ts
```

#### Auth flow

1. `POST /api/v1/auth/register` — hashes password (bcrypt, 10 rounds), saves user, returns `{ accessToken, refreshToken }`
2. `POST /api/v1/auth/login` — verifies password, returns token pair
3. `POST /api/v1/auth/refresh` — validates refresh token in DB, deletes old one, issues new pair (rotation)
4. All other endpoints require `Authorization: Bearer <accessToken>` header

#### Common auth decorators

```typescript
// Mark a route as public (no JWT required)
@Public()
@Post('register')

// Get current user in controller
@Get('me')
getMe(@CurrentUser() user: User) { ... }
```

---

## Project structure

```
src/
├── modules/
│   ├── auth/           # JWT auth, guards, strategies (see Auth section)
│   ├── users/          # User entity
│   │   ├── user.entity.ts
│   │   └── users.module.ts
│   ├── research/       # Core feature: create/read reports
│   ├── queue/          # BullMQ processors and producers
│   ├── search/         # OpenSearch client wrapper
│   ├── ai/             # AI SDK wrappers (Anthropic, OpenAI)
│   ├── stripe/         # Stripe service, webhook handler
│   └── export/         # PDF export logic
├── common/
│   ├── decorators/
│   │   ├── public.decorator.ts       # @Public()
│   │   └── current-user.decorator.ts # @CurrentUser()
│   ├── entities/
│   │   └── base.entity.ts            # id (uuid), createdAt, updatedAt
│   ├── filters/
│   │   └── http-exception.filter.ts  # Global error handler → { statusCode, error, message }
│   └── interceptors/
│       └── transform.interceptor.ts  # Wraps all responses → { data }
├── config/
│   └── env.schema.ts   # Zod schema — app refuses to start if vars are missing
├── database/
│   ├── data-source.ts  # TypeORM DataSource for CLI
│   └── migrations/     # TypeORM migrations only — no manual SQL
└── main.ts
```

---

## Environment variables

All env vars are validated at startup via Zod inside `config/env.schema.ts`. The app refuses to start if required vars are missing.

```
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/research

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# OpenSearch
OPENSEARCH_URL=http://localhost:9200
OPENSEARCH_INDEX=research-dev

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

---

## Database conventions

- Table names: **snake_case plural** (`research_reports`, `refresh_tokens`)
- Column names: **snake_case**
- All entities extend a `BaseEntity` with `id` (uuid), `createdAt`, `updatedAt`
- Foreign keys: `userId`, `reportId` (camelCase in TypeORM, `user_id` in DB)
- Soft deletes via `deletedAt` (TypeORM `@DeleteDateColumn`) where needed

### Key entities
- `users` — id, email, passwordHash, subscriptionStatus
- `research_reports` — id, userId, topic, status (pending | processing | done | failed), summary, sources (jsonb)
- `refresh_tokens` — id, userId, token, expiresAt
- `subscriptions` — id, userId, stripeCustomerId, stripeSubscriptionId, status, plan

---

## Queue conventions

Every BullMQ job must have:
- A typed payload interface (e.g. `ResearchJobPayload`)
- A processor class decorated with `@Processor('research')`
- Error handling with retry strategy (3 attempts, exponential backoff)
- Status updates written back to `research_reports` table

```typescript
// Example job payload
interface ResearchJobPayload {
  reportId: string;
  userId: string;
  topic: string;
}
```

---

## API conventions

- Base path: `/api/v1`
- All responses wrapped: `{ data, meta? }` for success, `{ error, message, statusCode }` for errors
- Validation: `class-validator` + `ValidationPipe` globally enabled
- Pagination: cursor-based for lists (avoid offset pagination)
- All endpoints require `JwtAuthGuard` unless explicitly marked `@Public()`

### Key endpoints
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

POST   /api/v1/reports            # Create new research job
GET    /api/v1/reports            # List user's reports
GET    /api/v1/reports/:id        # Get report (polls for status)
DELETE /api/v1/reports/:id

GET    /api/v1/reports/:id/export # PDF export (subscription required)

POST   /api/v1/webhooks/stripe    # Stripe webhook (no auth)
```

---

## Infrastructure

### Docker
- `docker-compose.yml` runs: postgres, redis, opensearch for local dev
- App itself runs locally via `pnpm dev` (not in Docker during development)
- Production: all services including app run in Docker

### CI/CD (GitHub Actions)
- On push to `main`: lint → test → build → deploy
- Deploy: SSH into VPS, pull image, `docker compose up -d`
- Secrets stored in GitHub Actions secrets, never in the repo

### Scripts
```
npm run dev               # Start with hot reload
npm run build             # Compile TypeScript
npm test                  # Unit tests (Jest)
npm run test:e2e          # E2E tests
npm run migration:generate   # Generate migration from entity changes
npm run migration:run        # Apply pending migrations
npm run migration:revert     # Revert last migration
```

---

## Code style

- Strict TypeScript — no `any`, no `as unknown`
- All public service methods must have explicit return types
- Use `async/await` — no raw `.then()` chains
- Prefer `readonly` for injected dependencies in constructors
- One module per feature — no god modules
- Keep controllers thin: validate input, call service, return result
- Business logic lives in services, not controllers or processors

---

## Testing

- Unit tests: Jest, co-located with source files (`*.spec.ts`)
- E2E tests: Supertest, in `test/` directory
- Use `@nestjs/testing` `createTestingModule` for unit tests
- Mock external services (Stripe, AI APIs, OpenSearch) — never call real APIs in tests
- Minimum coverage target: 70% for services

---

## Security checklist

- Never log full JWT tokens, API keys, or passwords
- Stripe webhook signature verified on every request
- Rate limiting on auth endpoints (`@nestjs/throttler`)
- SQL injection impossible via TypeORM parameterized queries — but double-check raw queries
- CORS configured explicitly — no wildcard in production
- Helmet enabled globally