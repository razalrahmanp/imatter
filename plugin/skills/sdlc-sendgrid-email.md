---
name: sdlc-sendgrid-email
description: Use when implementing transactional email via SendGrid from a backend worker — covers client singleton, dynamic-template enforcement, and the PII logging rule for recipient addresses.
---

## When to use

- Sending transactional email (welcome, password reset, receipt, alert) via SendGrid
- Migrating from inline HTML email strings to SendGrid dynamic templates
- Auditing existing email code for PII leakage in logs

## Architecture

```
app   →  POST /notifications/email  →  SQS queue  →  Lambda worker  →  SendGrid API
```

Same shape as FCM push — HTTP endpoint enqueues, worker sends. SQS gives you retries, DLQ, and rate isolation.

## Client singleton

The SendGrid client is cheap to construct but the API key fetch from Secrets Manager is not — cache both per container.

```ts
import sgMail from "@sendgrid/mail";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let initialized = false;

export async function getSendGridClient() {
  if (initialized) return sgMail;

  const client = new SecretsManagerClient({});
  const res = await client.send(new GetSecretValueCommand({ SecretId: process.env.SENDGRID_SECRET_ARN! }));
  const { api_key } = JSON.parse(res.SecretString!);

  sgMail.setApiKey(api_key);
  initialized = true;
  return sgMail;
}
```

## Dynamic templates only — never inline HTML

All email bodies live in SendGrid as dynamic templates. The code only supplies the `templateId` and the substitution variables. **Never** put HTML strings in source.

```ts
// ❌ Wrong
const html = `<h1>Hi ${user.name}</h1><p>Your order ${orderId} is ready</p>`;
await sg.send({ to, from, subject, html });

// ✅ Right
await sg.send({
  to,
  from,
  templateId: "d-abc123...",   // managed in SendGrid UI
  dynamicTemplateData: { name: user.name, order_id: orderId },
});
```

Why: HTML in code can't be A/B tested, can't be edited by non-engineers, must ship with a deploy, and is much harder to audit for injection.

## Worker pattern

```ts
export const handler = async (event: SQSEvent) => {
  const sg = await getSendGridClient();

  for (const record of event.Records) {
    const { to, template_id, data, message_id } = JSON.parse(record.body);

    try {
      await sg.send({
        to,
        from: { email: "noreply@example.com", name: "Example" },
        templateId: template_id,
        dynamicTemplateData: data,
        customArgs: { message_id }, // SendGrid echoes this back in webhooks
      });
      // Safe to log — message_id, template_id, NOT the recipient address.
      logger.info("email sent", { message_id, template_id });
    } catch (err) {
      logger.error("email failed", { message_id, template_id, err_code: err?.code });
      throw err; // let SQS retry
    }
  }
};
```

## Forbidden

- ❌ Logging the `to` address, recipient name, or any substitution variable from `dynamicTemplateData` — these are PII
- ❌ Building HTML in the application — use dynamic templates
- ❌ Hardcoding the API key (use Secrets Manager)
- ❌ Calling SendGrid synchronously from a user-facing request (use SQS)
- ❌ Re-initializing `sgMail.setApiKey` on every invocation

## Gate criteria

- SendGrid client is initialized once per container
- API key comes from Secrets Manager, not env var literal or source file
- No `to:`, recipient email, or `dynamicTemplateData` values appear in log statements
- All `sg.send` calls use `templateId` + `dynamicTemplateData`, not `html` or `text` fields
- Email send is invoked from an SQS-triggered worker, not from an HTTP request handler
