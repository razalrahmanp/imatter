---
name: sdlc-pii-handling
description: Use when designing storage, logs, or error reports that may touch personally identifiable information — covers what counts as PII, how to mask it, and what must never be logged.
---

## Rule

Personally identifiable information (PII) is data that can identify a natural person. PII is never logged in plaintext, never copied into error messages, never embedded in URLs, and never sent to third-party services (Sentry, Datadog, LogRocket) without masking.

## What counts as PII

| Category | Examples |
|---|---|
| Direct identifiers | Full name, email, phone, government ID, passport, SSN/Aadhaar/etc. |
| Online identifiers | IP address, device ID, cookie ID, fingerprint hash |
| Financial | Bank account, card number, UPI VPA, payment token |
| Biometric | Photo, fingerprint, voice print, iris scan |
| Location | GPS coordinates, full street address, precise altitude |
| Health | Diagnosis, prescription, lab result (often regulated separately) |
| Combination | Date of birth + ZIP code + gender is identifying ≥87% of the time (Sweeney, 2000) |

## Pattern — masking helpers

```ts
export const mask = {
  email: (e: string) => {
    const [user, domain] = e.split("@");
    return `${user[0]}***@${domain}`;
  },
  phone: (p: string) => p.replace(/\d(?=\d{4})/g, "*"),
  card: (c: string) => `****${c.slice(-4)}`,
  uuid: (u: string) => `${u.slice(0, 8)}...`,
  ip: (ip: string) => ip.split(".").slice(0, 2).concat(["xxx", "xxx"]).join("."),
};

// Use:
logger.info("auth attempt", { email: mask.email(req.body.email) });
```

## Where PII commonly leaks

| Surface | Leak |
|---|---|
| Logs | `logger.info("user signed up", { user })` — `user` contains email, name |
| Error reports | Stack traces include local variables containing PII |
| URLs | `?email=foo@bar.com` — logged by every proxy and gateway on the way |
| Analytics | Click events sending the page URL as a property when URL contains PII |
| LLM prompts | Sending raw user input to an LLM, including PII fields |
| Webhooks | Forwarding the entire request body to a third-party webhook |
| DB indexes | Indexing PII columns makes them appear in slow-query logs |

## Anti-patterns

- ❌ `logger.info("processing", { request: req })` — logs everything including PII
- ❌ Sanitizing PII in the logger config only — leaves a window in dev where it's still logged
- ❌ Hashing PII to "make it safe" — a hash of an email is still uniquely identifying
- ❌ Storing PII "in case we need it" — collect only what's currently required (data minimisation)
- ❌ Using PII as a primary key — makes deletion (GDPR Article 17) expensive

## Gate criteria

- A `mask` utility exists and is imported wherever PII is logged
- No raw email, phone, card number, government ID, or precise location appears in any `logger.*` or `console.*` call (grep)
- Error reporters (Sentry, Bugsnag, Rollbar) have a `beforeSend` hook that strips PII
- Request URLs in logs are sanitized to remove query strings on auth endpoints
- A documented list exists of which DB columns hold PII (for export and deletion requests)
