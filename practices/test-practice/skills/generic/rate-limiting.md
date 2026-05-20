---
id: rate-limiting
title: "Rate limiting — token bucket, per-user limits, 429 response with Retry-After"
layer: generic
tags: [rate-limiting, throttling, token-bucket, api, reliability]
applies_to:
  task_types: [add-endpoint, add-handler, add-integration]
  stages: [3, 5, 6]
size_tokens: 200
related: [error-handling, caching-strategy, api-endpoint-design, input-validation]
---

# rate-limiting — Rate Limiting Pattern

## Pattern Summary

Rate limit at the API boundary before requests hit your business logic. Return a proper 429 with a `Retry-After` header so clients can back off intelligently.

**Token bucket implementation (Redis-backed):**
```typescript
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;  // Unix timestamp
}

async function checkRateLimit(
  cache: RedisClient,
  key: string,         // e.g. `ratelimit:orders:${branchId}`
  limit: number,       // max requests per window
  windowSec: number    // window in seconds
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `${key}:${Math.floor(now / windowSec)}`;
  const resetAt = (Math.floor(now / windowSec) + 1) * windowSec;

  const count = await cache.incr(windowKey);
  if (count === 1) await cache.expire(windowKey, windowSec);

  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}
```

**Handler integration:**
```typescript
const rl = await checkRateLimit(redis, `ratelimit:orders:${branchId}`, 100, 60);

if (!rl.allowed) {
  return {
    statusCode: 429,
    headers: {
      "Retry-After": String(rl.resetAt - Math.floor(Date.now() / 1000)),
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(rl.resetAt),
    },
    body: JSON.stringify({ code: "rate_limit_exceeded", message: "Too many requests. Try again later." }),
  };
}
```

## Full Reference

### Rate limit key design
Key by: `branchId` (tenant isolation), `userId` (per-user limits for expensive ops), or `IP` (unauthenticated endpoints only). Never rate limit by IP alone for authenticated endpoints — NAT/proxy shares IPs across users.

### Default limits (starting points — tune per endpoint)
```
Standard CRUD: 100 req/min per branch
Search / analytics: 20 req/min per branch
AI/LLM endpoints: 10 req/min per branch
Bulk operations:  5 req/min per branch
```

### Forbidden
- Rate limiting without returning `Retry-After` (clients retry immediately and amplify load)
- Returning 429 without logging (monitor your rate limit hits — they indicate abuse or a client bug)
