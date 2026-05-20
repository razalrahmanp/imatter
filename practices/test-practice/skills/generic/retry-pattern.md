---
id: retry-pattern
title: "Retry pattern — exponential backoff, jitter, max attempts, non-retryable errors"
layer: generic
tags: [retry, exponential-backoff, jitter, reliability, resilience]
applies_to:
  task_types: [add-handler, add-worker, add-integration]
  stages: [3, 5]
size_tokens: 200
related: [error-handling, idempotency, circuit-breaker]
---

# retry-pattern — Retry with Exponential Backoff

## Pattern Summary

Retry transient failures only. Use exponential backoff with jitter. Set a hard limit on retries. Never retry non-idempotent operations without an idempotency key.

**Retry utility:**
```typescript
interface RetryOptions {
  maxAttempts: number;       // total attempts (not retries)
  initialDelayMs: number;    // first retry delay
  maxDelayMs: number;        // cap on delay
  retryable?: (err: unknown) => boolean;  // defaults to retrying all errors
}

async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Don't retry non-retryable errors
      if (opts.retryable && !opts.retryable(err)) throw err;
      if (attempt === opts.maxAttempts) break;

      // Exponential backoff with full jitter
      const base = Math.min(opts.initialDelayMs * 2 ** (attempt - 1), opts.maxDelayMs);
      const delay = Math.random() * base;  // full jitter — avoids thundering herd
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw lastError;
}
```

**Usage:**
```typescript
// Retry Bedrock calls (throttled = retryable; validation errors = not retryable)
const result = await withRetry(
  () => bedrock.invoke(params),
  {
    maxAttempts: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
    retryable: (err) => isThrottlingError(err) || isTransientNetworkError(err),
  }
);
```

## Full Reference

### What to retry
- Network timeouts, connection resets
- HTTP 429 (rate limited), 502/503/504 (transient gateway errors)
- DB connection pool exhaustion (ECONNREFUSED)

### What NOT to retry
- HTTP 400/401/403/404 (client errors — retrying won't help)
- Validation errors, deserialization errors
- Non-idempotent writes without an idempotency key

### Jitter types
Full jitter (`Math.random() * base`): best for distributed systems — avoids coordinated retry storms. Decorrelated jitter: even better for high-concurrency situations. Plain exponential with no jitter: bad for distributed systems.
