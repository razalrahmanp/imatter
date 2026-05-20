---
id: circuit-breaker
title: "Circuit breaker — open/half-open/closed, failure threshold, fallback response"
layer: generic
tags: [circuit-breaker, resilience, reliability, external-api, fault-tolerance]
applies_to:
  task_types: [add-handler, add-worker, add-integration]
  stages: [3, 5]
size_tokens: 200
related: [retry-pattern, error-handling, caching-strategy, structured-logging]
---

# circuit-breaker — Circuit Breaker Pattern

## Pattern Summary

A circuit breaker stops calling a failing dependency and returns a fast fallback response. This prevents a slow/down dependency from exhausting your connection pool or Lambda concurrency.

**Circuit states:**
```
CLOSED   — normal operation; requests flow through
OPEN     — dependency is failing; requests immediately return fallback (no calls made)
HALF-OPEN — after cooldown; one request let through to test if dependency recovered
```

**Lightweight implementation (Redis-backed state):**
```typescript
interface CircuitBreakerOptions {
  key: string;            // e.g. "cb:razorpay"
  failureThreshold: number;   // failures before OPEN
  cooldownMs: number;         // time in OPEN before HALF-OPEN
  fallback: () => unknown;    // what to return when OPEN
}

async function withCircuitBreaker<T>(
  cache: RedisClient,
  opts: CircuitBreakerOptions,
  fn: () => Promise<T>
): Promise<T> {
  const state = await cache.get(`${opts.key}:state`);

  if (state === "open") {
    logger.warn("circuit_breaker_open", { key: opts.key });
    return opts.fallback() as T;
  }

  try {
    const result = await fn();
    // Success — reset failure counter
    await cache.del(`${opts.key}:failures`);
    if (state === "half-open") await cache.del(`${opts.key}:state`);
    return result;
  } catch (err) {
    const failures = await cache.incr(`${opts.key}:failures`);
    if (failures === 1) await cache.expire(`${opts.key}:failures`, 60); // window: 60s

    if (failures >= opts.failureThreshold) {
      await cache.set(`${opts.key}:state`, "open", { PX: opts.cooldownMs });
      logger.error("circuit_breaker_opened", { key: opts.key, failures });
    }
    throw err;
  }
}
```

## Full Reference

### Fallback strategies
- **Cached response**: return last known good value from cache
- **Degraded response**: return partial data (e.g. menu without real-time stock)
- **Rejection**: return 503 with `Retry-After` — honest about unavailability

### When NOT to use a circuit breaker
Internal dependencies (your own DB, your own cache) — if the DB is down, you want requests to fail, not return stale data. Circuit breakers are for external/third-party dependencies you don't control.

### Cooldown tuning
Start at 30 seconds. Increase if the dependency typically needs longer to recover. Too short = HALF-OPEN floods the recovering service; too long = unnecessary degradation after recovery.
