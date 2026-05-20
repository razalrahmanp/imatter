---
id: pii-handling
title: "PII handling — never in logs, never in prompts, masking patterns"
layer: generic
tags: [security, privacy, pii, gdpr, logging, llm]
applies_to:
  task_types: [add-endpoint, add-worker, add-handler, modify-handler]
  stages: [6, 8]
size_tokens: 240
related: [structured-logging, secret-handling, authn-pattern]
---

# pii-handling — PII Protection Rules

## Pattern Summary

PII never appears in logs, never goes into LLM prompts, and never travels beyond the service that owns it.

```
// CORRECT — log an opaque ID, never the data itself
log("info", { action: "customer.lookup", customerId: customer.id });

// WRONG — logging PII
log("info", { email: customer.email, phone: customer.phone });
```

**What counts as PII (default; add project-specific items below):**
| Data | Classification | Logs | LLM prompt |
|------|---------------|------|-----------|
| Email / phone | PII | Never | Never |
| Full name | PII | Never | Never |
| Free-text customer input | Sensitive | Never | Never |
| Payment amount / card | Financial | Never | Never |
| Session / JWT token | Secret | Never | Never |
| Internal resource ID (UUID) | Non-PII | OK | OK |
| Aggregate counts | Non-PII | OK | OK |
| Timestamps | Non-PII | OK | OK |

**Redaction helper (use only in debug/dev — never in production logs):**
```typescript
export function redact(value: string): string {
  return value.slice(0, 2) + "***";
}
```

**LLM prompt rules:**
- Send IDs, timestamps, counts, and category labels to the model
- Never send names, emails, phone numbers, or raw user-typed text
- If you must classify customer-typed text: preprocess into categories first, send categories not text

## Full Reference

### Storage rules
- PII stored only in the authoritative service — not duplicated to logs, caches, or message queues
- Payment data stored only via tokenisation (Stripe token, Razorpay payment_id) — never raw card numbers

### Incident response
If PII appears in logs: note the log group + stream + timestamp, add a data protection filter going forward, open a security incident. Do not silently delete logs.
