---
name: sdlc-razorpay-webhook
description: Use when implementing a Razorpay payment webhook receiver — covers timing-safe HMAC verification, idempotency on payment_id, and the PII fields that must never be logged.
---

## When to use

- Implementing the `/webhooks/razorpay` endpoint (or equivalent)
- Adding new event types (`payment.captured`, `payment.failed`, `refund.processed`, etc.)
- Auditing an existing webhook for security regressions

## HMAC verification — use `timingSafeEqual`

String comparison (`===`) leaks timing information. Always use `crypto.timingSafeEqual`:

```ts
import crypto from "node:crypto";

function verifyRazorpaySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signature, "hex");
  const expBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expBuf.length) return false; // timingSafeEqual throws on length mismatch
  return crypto.timingSafeEqual(sigBuf, expBuf);
}
```

The webhook secret comes from AWS Secrets Manager / your secret store — **never hardcoded** and **never in environment variables in plain text**.

## Always verify on the raw body

If your framework parses the JSON body before you see it, signature verification will fail because the re-serialized JSON does not byte-match the original. Capture the raw body first:

```ts
// Express
app.post("/webhooks/razorpay", express.raw({ type: "application/json" }), handler);

// Lambda + API Gateway — event.body is the raw string (when isBase64Encoded is false)
```

## Idempotency on `payment_id`

Razorpay can deliver the same webhook more than once. Enforce idempotency at the DB layer with a UNIQUE constraint:

```sql
CREATE TABLE razorpay_events (
  razorpay_payment_id TEXT PRIMARY KEY,    -- enforces idempotency
  event_type          TEXT NOT NULL,
  status              TEXT NOT NULL,
  received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount_paise        BIGINT NOT NULL
);
```

```ts
try {
  await db.razorpay_events.insert({ razorpay_payment_id, event_type, status, amount_paise });
} catch (err) {
  if (isUniqueViolation(err)) return reply(200, "ok"); // already processed — Razorpay treats 2xx as ack
  throw err;
}
```

Always return 2xx to Razorpay even for duplicates — non-2xx triggers a retry.

## PII — never log

Razorpay payloads contain fields that **must not** appear in any log statement, console output, or error tracker:

- `payload.payment.entity.vpa` (UPI VPA)
- `payload.payment.entity.card_id` and `.card.last4`
- `payload.payment.entity.contact` (phone number)
- `payload.payment.entity.email`
- `payload.payment.entity.notes` (may contain customer-supplied PII)

Safe to log: `payment_id`, `order_id`, `status`, `amount`, `currency`, `event_type`.

```ts
// ❌ Wrong
logger.info("razorpay event", { payload });

// ✅ Right
logger.info("razorpay event", {
  payment_id: payload.payment.entity.id,
  status: payload.payment.entity.status,
  amount: payload.payment.entity.amount,
});
```

## Forbidden

- ❌ Using `===` for signature comparison (timing attack)
- ❌ Verifying after JSON parsing (signature won't match re-serialized body)
- ❌ Storing the webhook secret in plaintext env vars (use Secrets Manager / equivalent)
- ❌ Logging any field from the PII list above
- ❌ Returning non-2xx for "already processed" cases (causes infinite retries)

## Gate criteria

- Signature verification uses `crypto.timingSafeEqual` (grep for `timingSafeEqual` in the webhook handler)
- Raw body is captured before any JSON parsing
- DB enforces uniqueness on `razorpay_payment_id`
- No PII fields appear in `console.*` or `logger.*` calls (grep for `vpa`, `card_id`, `contact`, `email`)
- Webhook secret is fetched from Secrets Manager, not env var literal
