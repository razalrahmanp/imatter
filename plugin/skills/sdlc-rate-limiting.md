---
name: sdlc-rate-limiting
description: Use when designing any public endpoint, auth flow, or expensive operation — picks the right rate-limiter algorithm and prevents abuse.
---

## Rule

Every public endpoint has a rate limit. Sensitive operations (login, password reset, payment, signup) have stricter limits per IP and per account. Rate limits are enforced server-side, return 429 on violation, and include `Retry-After`.

## What to rate-limit, at what rate

| Endpoint type | Rate (per IP) | Rate (per account) | Notes |
|---|---|---|---|
| Login / authentication | 5 / min | 10 / min | Account lockout at 10 fails |
| Password reset | 3 / hour | 3 / hour | Per-IP and per-account |
| Account signup | 10 / hour | n/a | Per IP only |
| Payment / charge | 60 / hour | 60 / hour | Adjust for B2B |
| Generic authenticated API | 600 / min | 600 / min | (10 rps) |
| Generic unauthenticated public | 60 / min | n/a | Per IP |
| Expensive endpoints (search, export, AI/LLM) | 30 / min | 30 / min | Cost-aware |
| Webhook receive | n/a | n/a | Source IP allowlist instead |

These are starting points. Tune from real traffic in monitoring.

## Algorithms — pick one

| Algorithm | When | Pros | Cons |
|---|---|---|---|
| **Fixed window** | Easy implementation, tolerant systems | Simple, low memory | Burst at window boundary (2× rate possible) |
| **Sliding window log** | Precise limits | Exact | High memory (one entry per request) |
| **Sliding window counter** | Most common, good tradeoff | Smooth, low memory | Approximate |
| **Token bucket** | Bursts allowed, average shaped | Allows bursts, shapes average | More state to manage |
| **Leaky bucket** | Smoothing required (e.g. SMS) | Smooth output | Bursts queued or dropped |

For most apps: **sliding window counter** in Redis. For payment-like flows where bursts are unacceptable: token bucket with small bucket.

## Pattern — Redis sliding window counter

```ts
async function checkRate(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; remaining: number; resetMs: number }> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const currentWindow = Math.floor(now / windowMs);
  const previousWindow = currentWindow - 1;
  const fractionInCurrent = (now % windowMs) / windowMs;

  const [curr, prev] = await redis.mget(
    `${key}:${currentWindow}`,
    `${key}:${previousWindow}`
  );

  const currentCount = Number(curr ?? 0);
  const previousCount = Number(prev ?? 0);
  // Weighted estimate: previous window's count weighted by (1 - fraction)
  const estimated = Math.floor(previousCount * (1 - fractionInCurrent) + currentCount);

  if (estimated >= limit) {
    return { ok: false, remaining: 0, resetMs: windowMs - (now % windowMs) };
  }

  await redis.incr(`${key}:${currentWindow}`);
  await redis.expire(`${key}:${currentWindow}`, windowSec * 2);

  return { ok: true, remaining: limit - estimated - 1, resetMs: windowMs - (now % windowMs) };
}
```

## Pattern — middleware

```ts
export function rateLimit(opts: { limit: number; windowSec: number; keyFn: (req: Req) => string }) {
  return async (req: Req, res: Res, next: () => void) => {
    const key = opts.keyFn(req);
    const result = await checkRate(key, opts.limit, opts.windowSec);

    res.setHeader("X-RateLimit-Limit", opts.limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetMs / 1000));

    if (!result.ok) {
      res.setHeader("Retry-After", Math.ceil(result.resetMs / 1000));
      return res.status(429).json({ error: "rate_limit_exceeded" });
    }
    next();
  };
}

// Compose multiple:
app.post("/login",
  rateLimit({ limit: 5, windowSec: 60, keyFn: r => `ip:${r.ip}` }),
  rateLimit({ limit: 10, windowSec: 60, keyFn: r => `acct:${r.body.email}` }),
  loginHandler
);
```

## Key choice

| Operation | Key |
|---|---|
| Per-IP limit | `ip:${req.ip}` (with `X-Forwarded-For` handling) |
| Per-account limit | `acct:${user_id}` or `acct:${email}` |
| Per-tenant limit | `tnt:${tenant_id}` |
| Per-resource limit | `res:${resource_id}` |

For IP: trust `X-Forwarded-For` only if behind a known proxy; otherwise it's spoofable.

## Anti-patterns

- ❌ Rate limit only in the client / UI (trivially bypassed)
- ❌ No headers in 429 response (clients can't back off intelligently)
- ❌ Same limit per IP and per account (an IP can hit a single account too easily)
- ❌ In-memory rate limiter with multiple instances (each instance has its own counter — limit × N)
- ❌ Limiting only after the work is done (must check before doing the expensive operation)
- ❌ Returning 503 instead of 429 (semantically wrong; clients won't retry correctly)
- ❌ Forgetting account lockout on auth (rate limit alone allows credential stuffing across IPs)

## Gate criteria

- Every public endpoint has at least one rate-limit layer
- Auth endpoints have both per-IP and per-account limits
- 429 responses include `X-RateLimit-*` and `Retry-After` headers
- Rate limit state is in shared storage (Redis), not per-instance memory
- A dashboard shows current 429 rate by endpoint
- An alert fires if 429 rate exceeds baseline (could indicate abuse or misconfigured client)
