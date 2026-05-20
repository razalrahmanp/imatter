---
id: sendgrid-email
title: "SendGrid email — transactional email via dynamic templates from Lambda"
layer: stack
stack: react-supabase-lambda
tags: [sendgrid, email, notifications, lambda, aws]
applies_to:
  task_types: [add-worker, modify-worker]
  stages: [3, 5]
size_tokens: 220
related: [lambda-worker, secrets-management, pii-handling, sqs-trigger]
---

# sendgrid-email — SendGrid Transactional Email Pattern

## Pattern Summary

All transactional email goes through a single Lambda worker triggered by SQS. Never call SendGrid from request-path handlers. Use SendGrid dynamic templates — never build HTML strings in code.

**SendGrid client (`src/shared/email.ts`):**
```typescript
import sgMail from "@sendgrid/mail";
import { getSecret } from "./secrets";

let initialised = false;

async function ensureInit(): Promise<void> {
  if (initialised) return;
  const apiKey = await getSecret(process.env.SENDGRID_SECRET_NAME!);
  sgMail.setApiKey(apiKey);
  initialised = true;
}

export async function sendTemplateEmail(params: EmailParams): Promise<void> {
  await ensureInit();
  await sgMail.send({
    to:           params.to,
    from:         { email: process.env.SENDGRID_FROM_EMAIL!, name: "Tea Shop" },
    templateId:   params.templateId,
    dynamicTemplateData: params.templateData,
    // Never pass PII beyond what the template strictly needs
  });
}
```

**SQS worker:**
```typescript
// src/functions/notifications/email-worker.ts
export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    const job = JSON.parse(record.body) as EmailJob;
    try {
      await sendTemplateEmail(job);
    } catch (err) {
      log.error("SendGrid delivery failed", { templateId: job.templateId });
      throw err; // SQS retries; DLQ after maxReceiveCount
    }
  }
};
```

**Enqueue from a handler:**
```typescript
await sqs.send(new SendMessageCommand({
  QueueUrl:    process.env.EMAIL_QUEUE_URL!,
  MessageBody: JSON.stringify({
    to:           order.customer_email,
    templateId:   "d-order-confirmation-template-id",
    templateData: { order_id: order.id, total: formatAmount(order.total) },
  } satisfies EmailJob),
}));
```

## Full Reference

### Template data rules
- `templateData` keys must match the SendGrid template variable names exactly.
- Include only fields the template actually renders — no extra data.
- Never include `card_number`, `upi_vpa`, `password`, or free-form `notes` from orders.

### Bounce and unsubscribe handling
SendGrid sends event webhooks for bounces, spam reports, and unsubscribes. Handle in a separate webhook handler; suppress future sends to bounced/unsubscribed addresses by checking against a local suppress list.

### From address
Always set `from.name` to a human-readable name ("Tea Shop"). Bare email addresses land in spam. Confirm the from address is authenticated (SPF/DKIM/DMARC) via SendGrid domain authentication before going live.

### Environment variables
| Variable | Value |
|---|---|
| `SENDGRID_SECRET_NAME` | Secrets Manager key holding the SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Verified sender address (e.g. `orders@rabos.io`) |
| `EMAIL_QUEUE_URL` | SQS queue URL for email jobs |

### Forbidden
- Hardcoding the SendGrid API key in code or environment variables — use Secrets Manager
- Sending email from a synchronous request handler (p99 degradation on SendGrid latency)
- Building HTML email bodies in code — use SendGrid dynamic templates
- Logging `to` email addresses (PII) — log only `templateId` and `order_id`
- Using the `sendgrid/mail` API without `setApiKey` called (throws 401 on first send)
