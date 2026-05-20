---
description: Smoke-test the running NestJS backend against all implemented endpoints
---

## Prerequisites

App must already be running on `http://localhost:8082`. If not — run `/run` first.

## Setup

```bash
BASE=http://localhost:8082/api/v1
PASS=0
FAIL=0

check() {
  local label=$1
  local actual=$2
  local expected=$3
  if echo "$actual" | grep -q "$expected"; then
    echo "  ✓ $label"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label"
    echo "    expected: $expected"
    echo "    got:      $actual"
    FAIL=$((FAIL + 1))
  fi
}
```

## Auth endpoints

```bash
echo "\n── Auth ──"

# Register new user
REGISTER=$(curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke_'$(date +%s)'@test.com","password":"password123"}')
check "POST /auth/register → 200 + accessToken" "$REGISTER" "accessToken"

ACCESS_TOKEN=$(echo $REGISTER | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
REFRESH_TOKEN=$(echo $REGISTER | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)

# Login with wrong password → 401
WRONG_LOGIN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"wrongpass"}')
check "POST /auth/login (wrong password) → 401" "$WRONG_LOGIN" "401"

# Refresh token rotation
REFRESH=$(curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
check "POST /auth/refresh → new accessToken" "$REFRESH" "accessToken"

# Protected route without token → 401
UNAUTH=$(curl -s $BASE)
check "GET / without token → 401" "$UNAUTH" "401"

# Protected route with valid token → not 401
AUTHED=$(curl -s -o /dev/null -w "%{http_code}" $BASE \
  -H "Authorization: Bearer $ACCESS_TOKEN")
check "GET / with token → not 401" "$AUTHED" "200"
```

## Summary

```bash
echo "\n── Result: $PASS passed, $FAIL failed ──"
[ $FAIL -eq 0 ] && echo "All smoke tests passed." || echo "Some tests FAILED."
```
