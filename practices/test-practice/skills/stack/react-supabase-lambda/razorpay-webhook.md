---
id: razorpay-webhook
title: "Razorpay webhook — HMAC verification, idempotent event handling"
layer: stack
stack: react-supabase-lambda
tags: [razorpay, payment, webhook, hmac, security, idempotency]
applies_to:
  task_types: [add-handler, modify-handler]
  stages: [3, 5, 6]
size_tokens: 240
related: [lambda-handler, idempotency, secrets-management, pii-handling]
---

# razorpay-webhook — Razorpay Webhook Handler Pattern

## Pattern Summary

Always verify the `x-razorpay-signature` HMAC before processing. Process events idempotently using the `razorpay_payment_id` as the idempotency key. Log order metadata only — never log card details or UPI VPA.

**Signature verification:**
```typescript
import crypto from "crypto";
import { getSecret } from "../../shared/secrets";

export async function verifyRazorpaySignature(
  rawBody: string,
  signature: string,
): Promise<boolean> {
  const secret = await getSecret(process.env.RAZORPAY_WEBHOOK_SECRET_NAME!);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

**Handler pattern:**
```typescript
export const handler: APIGatewayProxyHandler = async (event) => {
  const sig = event.headers["x-razorpay-signature"];
  if (!sig) return { statusCode: 400, body: "Missing signature" };

  const bodyStr = event.body ?? "";
  if (!(await verifyRazorpaySignature(bodyStr, sig))) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  const payload = JSON.parse(bodyStr) as RazorpayEvent;

  switch (payload.event) {
    case "payment.captured":
      await handlePaymentCaptured(payload.payload.payment.entity);
      break;
    case "payment.failed":
      await handlePaymentFailed(payload.payload.payment.entity);
      break;
    default:
      // Acknowledge unhandled events — don't let Razorpay retry indefinitely
      break;
  }

  return { statusCode: 200, body: "OK" };
};

async function handlePaymentCaptured(payment: RazorpayPayment): Promise<void> {
  // Idempotency: skip if already processed
  const exists = await db.query(
    "SELECT 1 FROM payment_events WHERE razorpay_payment_id = $1",
    [payment.id],
  );
  if (exists.rows.length) return;

  await db.query(
    `INSERT INTO payment_events (razorpay_payment_id, order_id, amount, status, captured_at)
     VALUES ($1, $2, $3, 'captured', NOW())`,
    [payment.id, payment.order_id, payment.amount],
  );

  // Update order status
  await db.query(
    "UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE razorpay_order_id = $1",
    [payment.order_id],
  );
}
```

## Full Reference

### Razorpay event types relevant to Tea Shop
| Event | When fired | Action |
|---|---|---|
| `payment.captured` | Payment confirmed and captured | Mark order paid, trigger fulfillment |
| `payment.failed` | Payment declined | Notify staff, release table hold |
| `order.paid` | Razorpay order fully settled | Cross-check with payment.captured |
| `refund.created` | Refund initiated | Log refund record, notify customer |

### Retries
Razorpay retries failed webhooks up to 5 times with exponential backoff. Idempotency on `razorpay_payment_id` is essential — your handler will be called multiple times for the same event.

### `payment_events` table
```sql
CREATE TABLE payment_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_payment_id TEXT NOT NULL UNIQUE,
  order_id            TEXT NOT NULL,
  amount              INTEGER NOT NULL,   -- in paise (INR smallest unit)
  status              TEXT NOT NULL,
  captured_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### What NOT to log
Never log: `card_id`, `bank`, `vpa` (UPI Virtual Payment Address), `contact`, `email`. These are PII and payment credentials. Log only: `payment.id`, `order.id`, `amount`, `status`.

### Forbidden
- Using string comparison for HMAC (`===` instead of `timingSafeEqual`) — timing attack vector
- Trusting `payment.status` from the body without HMAC verification
- Processing without idempotency check — Razorpay retries cause duplicate captures
- Logging UPI VPA, card details, or customer contact from payment payload
