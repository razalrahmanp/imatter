---
name: sdlc-idempotency-keys
description: Use when designing any mutation endpoint that could be retried (payment, order creation, webhook handler, queue consumer) — covers the idempotency key pattern and the storage requirements.
---

## Rule

Any endpoint that creates, charges, or sends something — and could be called more than once due to retries, network blips, or duplicate webhooks — must be idempotent. Two identical calls with the same idempotency key produce one effect and the same response.

## When you need idempotency

| Operation | Why |
|---|---|
| Payment capture | Client may retry on timeout; double-charge is unacceptable |
| Order creation | Duplicate order on flaky network |
| Email/SMS send | Mobile clients retry; duplicate notification is bad UX |
| Webhook receiver | Sender retries on non-2xx; you must dedupe |
| Queue consumer | At-least-once delivery is the default — dedupe at consumer |
| External API call (Stripe, Razorpay, etc.) | Their docs require/recommend an idempotency key |

## Pattern — client-supplied key

```ts
// Client generates a UUID per logical operation; reuses on retry
const idempotencyKey = crypto.randomUUID();

await fetch("/api/payments", {
  method: "POST",
  headers: { "Idempotency-Key": idempotencyKey, ... },
  body: JSON.stringify({ ... }),
});
```

Server:

```ts
export const handler = async (req, res) => {
  const key = req.headers["idempotency-key"];
  if (!key || typeof key !== "string") {
    return res.status(400).json({ error: "missing Idempotency-Key header" });
  }

  // Try to insert the key first — UNIQUE constraint provides atomicity
  try {
    await db.idempotency_keys.insert({
      key,
      route: "POST /payments",
      status: "in_progress",
      created_at: new Date(),
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Already seen — return stored response
      const existing = await db.idempotency_keys.findByKey(key);
      if (existing.status === "in_progress") {
        return res.status(409).json({ error: "request still processing" });
      }
      return res.status(existing.response_status).json(existing.response_body);
    }
    throw err;
  }

  // Do the actual work
  const result = await processPayment(req.body);

  // Store response for future retries
  await db.idempotency_keys.update(key, {
    status: "complete",
    response_status: 200,
    response_body: result,
  });

  return res.json(result);
};
```

## Storage shape

```sql
CREATE TABLE idempotency_keys (
  key             TEXT PRIMARY KEY,
  route           TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('in_progress', 'complete', 'failed')),
  response_status INTEGER,
  response_body   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
);

CREATE INDEX idempotency_keys_expires_at ON idempotency_keys (expires_at);
```

Run a periodic cleanup deleting rows past `expires_at` (24h is typical; Stripe uses 24h).

## Webhook idempotency

For webhooks, the *sender's* event ID is the natural idempotency key — you don't control it but it's already unique per logical event:

```ts
// Razorpay sends event.id; Stripe sends event.id; etc.
try {
  await db.webhook_events.insert({
    event_id: payload.id,           // UNIQUE constraint
    source: "razorpay",
    received_at: new Date(),
  });
} catch (err) {
  if (isUniqueViolation(err)) return reply(200, "ok"); // already processed
  throw err;
}
processEvent(payload);
```

See also [[sdlc-razorpay-webhook]] for a worked example.

## Anti-patterns

- ❌ Treating the request body hash as the idempotency key (a retried request may have a new timestamp/nonce, hash changes)
- ❌ Using the user ID as the key (a user can legitimately create two orders)
- ❌ Returning 200 with new data on a duplicate idempotency key (must return the *original* response)
- ❌ Storing only the key, not the response — second call cannot return the right answer
- ❌ TTL too short (retries happen for hours; 24h minimum)
- ❌ No cleanup job — table grows unbounded

## Gate criteria

- Every mutation endpoint either accepts an Idempotency-Key header or is itself idempotent by design (e.g. PUT on a deterministic resource path)
- Webhook handlers dedupe on the sender's event ID
- An idempotency-keys table exists with UNIQUE constraint on the key
- The stored response is returned on duplicate calls (not a fresh execution)
- A cleanup job removes expired keys
