---
id: webhook-pattern
title: "Webhook pattern — signature verification, async processing, replay safety"
layer: generic
tags: [webhook, signature, hmac, idempotency, reliability, integration]
applies_to:
  task_types: [add-endpoint, add-handler, add-integration]
  stages: [3, 5]
size_tokens: 200
related: [idempotency, error-handling, structured-logging, input-validation]
---

# webhook-pattern — Inbound Webhook Pattern

## Pattern Summary

Verify webhook signatures before processing. Acknowledge immediately (return 200), then process async. Store the raw payload for replay. Never trust the request body without signature verification.

**Signature verification (HMAC-SHA256):**
```typescript
import { createHmac, timingSafeEqual } from "crypto";

function verifyWebhookSignature(
  payload: Buffer,       // raw request body — must be Buffer, not parsed JSON
  signature: string,     // from header (e.g. "X-Razorpay-Signature" or "X-Hub-Signature-256")
  secret: string
): boolean {
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  // timingSafeEqual prevents timing attacks
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

**Acknowledge-then-process pattern:**
```typescript
export const handler = async (event: APIGatewayProxyEvent) => {
  const rawBody = Buffer.from(event.body ?? "", event.isBase64Encoded ? "base64" : "utf-8");
  const sig = event.headers["x-provider-signature"] ?? "";

  if (!verifyWebhookSignature(rawBody, sig, WEBHOOK_SECRET)) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  const payload = JSON.parse(rawBody.toString());

  // Store raw event first — enables replay
  await db.query(
    "INSERT INTO webhook_events (id, provider, event_type, payload, received_at) VALUES ($1,$2,$3,$4,NOW())",
    [payload.id, "razorpay", payload.event, payload]
  );

  // Enqueue for async processing — return 200 immediately
  await sqs.send(new SendMessageCommand({
    QueueUrl: WEBHOOK_QUEUE_URL,
    MessageBody: JSON.stringify({ webhookEventId: payload.id }),
    MessageDeduplicationId: payload.id,  // SQS FIFO dedup
  }));

  return { statusCode: 200, body: "OK" };
};
```

## Full Reference

### Why raw body for signature
Signature is computed over the raw bytes. If you parse JSON first, whitespace normalisation changes the bytes and breaks verification. Read the raw body before any JSON parsing.

### Replay safety
Workers should check if `webhook_events.processed_at` is already set before acting. Use `payload.id` as the idempotency key (see idempotency skill).

### Forbidden
- Parsing the body before verifying the signature
- Processing webhooks synchronously in the HTTP handler (provider retries if you take > 5s)
- Returning a non-200 status for duplicate events (providers interpret that as a failure and retry)
