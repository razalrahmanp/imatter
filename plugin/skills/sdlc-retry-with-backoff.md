---
name: sdlc-retry-with-backoff
description: Use when making any call to an external service (HTTP, database, queue, cloud SDK) — covers exponential backoff, jitter, the retry budget, and which errors are retryable.
---

## Rule

Every external call can fail. Most failures are transient. Retry the transient ones with exponential backoff and jitter. Stop retrying when you exceed the budget or hit a non-retryable error.

## Pattern

```ts
async function callWithRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseMs?: number; maxMs?: number; isRetryable?: (e: unknown) => boolean } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const baseMs = opts.baseMs ?? 200;
  const maxMs = opts.maxMs ?? 5000;
  const isRetryable = opts.isRetryable ?? defaultIsRetryable;

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts - 1) throw err;

      // Exponential backoff with full jitter (AWS Architecture Blog recommendation)
      const expBackoff = Math.min(maxMs, baseMs * 2 ** attempt);
      const sleepMs = Math.floor(Math.random() * expBackoff);
      await new Promise(r => setTimeout(r, sleepMs));
    }
  }
  throw lastErr;
}

function defaultIsRetryable(err: unknown): boolean {
  // Network errors
  if (err && typeof err === "object") {
    const code = (err as any).code;
    if (["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"].includes(code)) return true;
  }
  // HTTP 5xx and 429
  const status = (err as any)?.status ?? (err as any)?.response?.status;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  return false;
}
```

## What to retry

| Error | Retry? | Notes |
|---|---|---|
| Network timeout, connection reset | Yes | Transient |
| DNS failure (`EAI_AGAIN`) | Yes | DNS resolver may be flapping |
| 429 Too Many Requests | Yes | Honor `Retry-After` header if present |
| 503 Service Unavailable | Yes | Honor `Retry-After` |
| 500, 502, 504 | Yes | Could be transient |
| 401, 403 | No | Won't change on retry |
| 400, 404, 409 | No | Client error — fix the request, not retry |
| 5xx with idempotency key | Yes | Safe because of idempotency |
| 5xx without idempotency on a mutation | **Careful** | May double-execute; design idempotency first |

## Jitter — use full jitter

```
sleep = random(0, min(cap, base * 2^attempt))
```

This is "full jitter" — the upper bound grows exponentially, but the actual sleep is random within `[0, bound]`. Reduces thundering herd vs. plain exponential.

Empirical: Full jitter outperforms equal jitter and decorrelated jitter for most workloads (AWS Architecture Blog, "Exponential Backoff And Jitter", 2015).

## Honor `Retry-After`

```ts
const retryAfter = err.response?.headers?.["retry-after"];
if (retryAfter) {
  const ms = isNaN(Number(retryAfter))
    ? new Date(retryAfter).getTime() - Date.now()   // HTTP-date format
    : Number(retryAfter) * 1000;                    // seconds
  await sleep(Math.max(0, ms));
  continue;
}
```

## Anti-patterns

- ❌ Retrying without backoff (DoS the dependency)
- ❌ Retrying 4xx errors (won't change on retry, wastes budget)
- ❌ Retrying with too many attempts (5+) on user-facing paths — increases tail latency badly
- ❌ Catching and retrying inside the called function AND the caller (multiplied retries — exponential explosion)
- ❌ No retry budget — keeps retrying forever
- ❌ Retrying mutations without idempotency key (double-charge risk)
- ❌ Same delay across all clients (thundering herd on recovery)

## Tuning by call site

| Call site | maxAttempts | baseMs | maxMs |
|---|---|---|---|
| User-facing API path | 2 | 100 | 1000 |
| Background job, async worker | 5 | 500 | 30000 |
| Webhook delivery | 6+ over hours | 1000 | hours |
| Bedrock / LLM call | 3 | 1000 | 10000 |
| Database query (most) | 1 (let DB pool handle) | — | — |

User paths need tight budgets because tail latency matters; background work can afford patience.

## Gate criteria

- A `callWithRetry` (or equivalent) wrapper exists and is used at every external call site
- Backoff is exponential with jitter, not constant
- `Retry-After` header is honored when present
- Non-retryable errors (4xx except 429) are not retried
- No nested retry layers (the wrapper is the only retry layer)
- Retry budgets differ for user-facing vs. background paths
