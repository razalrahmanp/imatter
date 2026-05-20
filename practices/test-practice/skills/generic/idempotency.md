---
id: idempotency
title: "Idempotency — idempotency keys, dedup table, at-least-once safe handlers"
layer: generic
tags: [idempotency, reliability, at-least-once, dedup, distributed-systems]
applies_to:
  task_types: [add-handler, add-endpoint, add-worker]
  stages: [3, 5]
size_tokens: 205
related: [error-handling, retry-pattern, sqs-trigger, eventbridge-pattern]
---

# idempotency — Idempotency Pattern

## Pattern Summary

Any operation that can be retried must be idempotent — running it twice produces the same result as running it once. Use idempotency keys and a dedup table to enforce this.

**Dedup table:**
```sql
CREATE TABLE idempotency_keys (
  key         text PRIMARY KEY,           -- client-supplied UUID or event_id
  status      text NOT NULL,              -- 'processing' | 'completed' | 'failed'
  response    jsonb,                      -- cached response for completed requests
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + INTERVAL '24 hours'
);
CREATE INDEX ON idempotency_keys (expires_at);  -- for cleanup job
```

**Idempotency check in handler:**
```typescript
async function withIdempotency<T>(
  db: PoolClient,
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Check for existing result
  const { rows } = await db.query(
    "SELECT status, response FROM idempotency_keys WHERE key = $1",
    [key]
  );

  if (rows[0]?.status === "completed") {
    return rows[0].response as T;  // return cached response
  }

  if (rows[0]?.status === "processing") {
    throw new AppError("Request is already in progress", "request_in_progress", 409);
  }

  // Mark as processing
  await db.query(
    "INSERT INTO idempotency_keys (key, status) VALUES ($1, 'processing') ON CONFLICT DO NOTHING",
    [key]
  );

  try {
    const result = await fn();
    await db.query(
      "UPDATE idempotency_keys SET status='completed', response=$2 WHERE key=$1",
      [key, JSON.stringify(result)]
    );
    return result;
  } catch (err) {
    await db.query("UPDATE idempotency_keys SET status='failed' WHERE key=$1", [key]);
    throw err;
  }
}

// Usage
const idempotencyKey = event.headers["idempotency-key"] ?? crypto.randomUUID();
return withIdempotency(db, idempotencyKey, () => createOrder(payload));
```

## Full Reference

### Key scope
Idempotency keys are scoped to the operation (an `Idempotency-Key` header on `/orders` is only checked against `/orders`). Reusing a key for a different operation type is a client bug — validate the operation type matches.

### Key expiry
24 hours is standard. After expiry, the same key can be reused. Clean up expired rows with a nightly job.

### Event consumers
For event-driven consumers: use `event_id` from the event envelope as the idempotency key. Check before processing; record after success.
