---
description: Launch and smoke-test the NestJS backend
---

## Prerequisites

1. Docker must be running
2. `.env` file must exist (copy from `.env.example`)

## Launch

```bash
# Ensure Postgres is up
docker compose up -d

# Start the app in background via ts-node (no build needed)
npx ts-node -r tsconfig-paths/register src/main.ts &
APP_PID=$!
sleep 5
```

## Smoke tests

```bash
BASE=http://localhost:8082/api/v1

# 1. Register a new user
curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq .

# 2. Login
curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' | jq .

# 3. Hit a protected route without token → expect 401
curl -s $BASE/auth/register | jq .
```

## Teardown

```bash
kill $APP_PID 2>/dev/null || true
```

## Expected output

- Register → `{ "data": { "accessToken": "...", "refreshToken": "..." } }`
- Login → same shape
- Protected without token → `{ "statusCode": 401, "error": "UNAUTHORIZED", "message": "Unauthorized" }`
