---
name: sdlc-webhook-receiver
description: Use when implementing any webhook receiver (Stripe, Razorpay, GitHub, Slack, Twilio, internal partner integrations) — covers signature verification, idempotency, retry handling, and the body-parsing gotcha that breaks signatures.
---

## Rule

A webhook receiver has four jobs in this order: verify the signature, deduplicate, return 2xx fast, do the work async. Skip any one of those and you have a broken integration that's also a security hole.

## The body-parsing gotcha

Webhook signatures are computed over the **raw bytes** of the request body. If your framework parses JSON before you see it, your re-serialized JSON does not byte-match the original, and verification fails.

```ts
// Express — DO this BEFORE express.json() for webhook routes
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), handler);

// Lambda + API Gateway — event.body is already the raw string (if isBase64Encoded is false)

// Fastify
fastify.register(rawBody, { runFirst: true });

// Hono
app.post("/webhooks/x", async (c) => {
  const raw = await c.req.text();  // raw string
  ...
});
```

## Step 1 — Verify the signature

Every webhook provider gives a way to sign requests. Most use HMAC-SHA256 with a shared secret.

```ts
import crypto from "node:crypto";

function verifySignature(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signatureHeader, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);  // never use ===
}
```

- Always `timingSafeEqual` (see [[sdlc-razorpay-webhook]] for a worked Razorpay example)
- The secret comes from your secret store (see [[sdlc-secret-handling]])
- Reject with 401 if signature is missing or invalid — do not log the raw body

## Step 2 — Deduplicate

Webhook senders retry on non-2xx (and sometimes on timeouts even when you sent 2xx). The sender's event ID is the natural idempotency key.

```sql
CREATE TABLE webhook_events (
  source     TEXT NOT NULL,        -- 'stripe', 'razorpay', etc.
  event_id   TEXT NOT NULL,        -- sender's ID
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (source, event_id)
);
```

```ts
try {
  await db.webhook_events.insert({ source: "stripe", event_id: payload.id });
} catch (err) {
  if (isUniqueViolation(err)) {
    return res.status(200).end(); // already processed
  }
  throw err;
}
```

See [[sdlc-idempotency-keys]] for the broader pattern.

## Step 3 — Return 2xx fast

Webhook senders have tight timeouts (Stripe: 30s; some are 10s). If you process synchronously and the work takes too long, the sender sees a timeout, retries — and now you have a thundering herd.

**Pattern: enqueue, then return.**

```ts
export const handler = async (req, res) => {
  const raw = req.rawBody;
  if (!verifySignature(raw, req.header("X-Signature"), SECRET)) {
    return res.status(401).end();
  }
  const payload = JSON.parse(raw);

  // Idempotency
  try {
    await db.webhook_events.insert({ source: "stripe", event_id: payload.id });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(200).end();
    throw err;
  }

  // Enqueue for async processing
  await sqs.sendMessage({
    QueueUrl: WEBHOOK_QUEUE,
    MessageBody: JSON.stringify({ source: "stripe", payload }),
  });

  // Ack immediately
  return res.status(200).end();
};
```

The actual business logic runs in a separate SQS worker. If it fails, SQS retries; the DLQ catches permanent failures.

## Step 4 — Handle the work async

In the worker, read the event, do the work, mark it processed:

```ts
export const worker = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { source, payload } = JSON.parse(record.body);
    await processEvent(source, payload);
    await db.webhook_events.update(
      { source, event_id: payload.id },
      { processed_at: new Date() }
    );
  }
};
```

If processing throws, SQS re-delivers — that's why idempotency at the worker level matters too.

## Common providers — quick reference

| Provider | Signature header | Algorithm | Notes |
|---|---|---|---|
| Stripe | `Stripe-Signature` | HMAC-SHA256 | Format: `t=<ts>,v1=<sig>` — includes timestamp; verify timestamp is recent (5 min) |
| Razorpay | `X-Razorpay-Signature` | HMAC-SHA256 | See [[sdlc-razorpay-webhook]] |
| GitHub | `X-Hub-Signature-256` | HMAC-SHA256 | Format: `sha256=<hex>` |
| Slack | `X-Slack-Signature` | HMAC-SHA256 | Verify against `v0:<timestamp>:<body>` |
| Twilio | `X-Twilio-Signature` | HMAC-SHA1 (legacy) | Compute over full URL + sorted POST params |

Each has subtle differences — read the provider docs once, write a per-provider verifier.

## Anti-patterns

- ❌ Parsing JSON before verifying signature (signature won't match)
- ❌ Using `===` for signature comparison (timing attack)
- ❌ Doing the work synchronously inside the webhook handler (slow → timeout → retry storm)
- ❌ Returning 4xx/5xx for "already processed" (causes retries; return 200)
- ❌ No idempotency table → duplicate side effects on retries
- ❌ No DLQ on the queue → permanent failures silently lost
- ❌ Logging the raw payload (may contain PII — see [[sdlc-razorpay-webhook]] for what to strip)
- ❌ Verifying the timestamp is "approximately now" loosely — Stripe recommends ±5 minutes

## Gate criteria

- Raw body is captured before any JSON parsing
- Signature verified with `crypto.timingSafeEqual` — not `===`
- Signature secret comes from secret store, not env literal
- Timestamp in signature (where present) is verified within 5 minutes of now
- A `webhook_events` table with `(source, event_id)` PK deduplicates retries
- Webhook handler enqueues and returns 2xx within a few hundred ms
- Async worker is the only code that does the real processing
- A DLQ exists for the worker queue with alerting on non-zero depth
