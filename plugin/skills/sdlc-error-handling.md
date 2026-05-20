---
name: sdlc-error-handling
description: Use when writing any function that can fail — covers what to catch, what to throw, what to log, and the failure modes that hide real bugs.
---

## Rule

Errors are not noise to be silenced. They are signals to be classified, logged once, and propagated as either: (a) a typed result, (b) a thrown exception, or (c) a structured response — never as a swallowed exception or a magic value.

## Three categories — handle each differently

| Category | Example | Strategy |
|---|---|---|
| **Expected** (business outcome) | Out of stock, insufficient funds, validation failure | Return as a typed result; no log |
| **Unexpected, recoverable** | Network blip, DB timeout, rate limit | Log at WARN; retry with backoff |
| **Unexpected, unrecoverable** | Null pointer, type mismatch, programming bug | Log at ERROR; surface to operator |

The most common mistake is treating category 1 as category 3 (logging "ERROR: user is broke") or category 3 as category 1 (swallowing programming bugs).

## Pattern — typed results for business outcomes

```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

type CreateOrderError =
  | { kind: "out_of_stock"; sku: string }
  | { kind: "insufficient_funds"; required: number; available: number }
  | { kind: "tenant_disabled" };

async function createOrder(input: CreateOrderInput): Promise<Result<Order, CreateOrderError>> {
  if (await isTenantDisabled(input.tenant_id)) {
    return { ok: false, error: { kind: "tenant_disabled" } };
  }
  // ...
}
```

The caller handles each `kind` explicitly. The compiler enforces exhaustiveness.

## Pattern — throw for programming bugs

```ts
function divide(a: number, b: number): number {
  if (b === 0) throw new Error("divide by zero — caller bug");
  return a / b;
}
```

Top-level handler logs and returns 500. Don't catch low-level here.

## Pattern — retry for transient failures

```ts
async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.status >= 500) throw new TransientError(`5xx: ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (err instanceof TransientError || isNetworkError(err)) {
        await sleep(backoff(i));
        continue;
      }
      throw err; // not retryable
    }
  }
  throw lastErr;
}
```

See [[sdlc-retry-with-backoff]] for the backoff pattern.

## What goes in the log

```ts
logger.error("order creation failed", {
  err_message: err.message,
  err_stack: err.stack,
  err_code: (err as any).code,
  // Context
  route: "POST /orders",
  user_id: actor.id,            // safe — internal ID, not PII
  order_id: input.order_id,
  tenant_id: input.tenant_id,
});
// Don't log: req.body (may contain PII), full Error object (may contain PII in args)
```

## Anti-patterns

- ❌ `catch (e) {}` — silently swallowed
- ❌ `catch (e) { console.log(e); return null; }` — swallowed, ambiguous null
- ❌ Catching at the lowest level "just in case" and continuing — hides bugs
- ❌ Logging the same error at every layer as it bubbles up (log once, at the boundary)
- ❌ Wrapping every operation in try/catch (only catch what you handle)
- ❌ Throwing strings (`throw "oops"`) instead of Error instances
- ❌ Generic error messages ("something went wrong") returned to clients — at least include an error code
- ❌ Logging the full request body — leaks PII; log only safe fields

## Error responses to clients

```json
{
  "error": "out_of_stock",
  "message": "Item SKU-123 is out of stock",
  "details": { "sku": "SKU-123" },
  "request_id": "req_abc123"
}
```

- `error`: machine-readable code (enum-like)
- `message`: human-readable, safe for display
- `details`: structured context for clients to use
- `request_id`: for support to look up logs

## Gate criteria

- No `catch (e) {}` empty catches in source (grep for `catch.*{\s*}` and `catch.*{\s*return.*null`)
- Errors logged once at the boundary, not at every layer
- Business outcomes use typed Result, not thrown exceptions
- Client-facing errors include a `request_id` correlating to log entries
- Stack traces and error messages not exposed to unauthenticated callers
- No PII fields in error log statements (grep)
