---
name: sdlc-input-validation
description: Use when adding any endpoint, queue consumer, webhook receiver, or other system entry point — validates and shapes external input before it touches business logic.
---

## Rule

Every byte that enters the system from outside (HTTP body, query string, queue message, webhook payload, file upload, env var read at runtime) is validated *before* any business logic runs. Validate at the boundary, then trust the shape downstream.

## Pattern

Use a schema library (Zod, Pydantic, ajv, joi) and parse the input into a typed value. If parse fails, return 4xx immediately — do not log raw input.

```ts
import { z } from "zod";

const CreateOrderInput = z.object({
  customer_id: z.string().uuid(),
  items: z.array(z.object({
    sku: z.string().regex(/^[A-Z0-9-]+$/).max(64),
    qty: z.number().int().positive().max(999),
  })).min(1).max(100),
  notes: z.string().max(500).optional(),
});

export const handler = async (req, res) => {
  const parsed = CreateOrderInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid input", issues: parsed.error.issues });
  }
  return createOrder(parsed.data); // typed, safe
};
```

## What to validate

| Field type | Validation |
|---|---|
| String | Length cap, regex if format constrained, charset if needed |
| Number | Integer/float, min/max, no NaN/Infinity |
| Array | Min/max length, validate every element |
| Object | All required fields, no unknown fields (`.strict()` in Zod) |
| Date/timestamp | Parseable, within reasonable range (not 1970, not 9999) |
| URL | Allowed protocols only (`https:`), allowed domains if applicable |
| Email | RFC 5321 length cap (254), syntactic check only — do not verify deliverability |
| ID (UUID/ULID) | Format match — uppercase/lowercase consistent |

## Anti-patterns

- ❌ Trusting types because TypeScript says so — TS types do not exist at runtime
- ❌ Validating only some fields ("the rest will be obvious if they're wrong")
- ❌ Sanitizing instead of rejecting (silently truncating, lowercasing, stripping) — reject and let the caller fix
- ❌ Returning the full parse error including the input — leaks data shape and possibly PII
- ❌ Logging the raw body on parse failure — may contain secrets or PII

## Gate criteria

- Every endpoint/handler has a schema validation step before business logic
- No raw `req.body` accesses outside validators
- Unknown fields are rejected (`strict` mode in your schema lib)
- Length caps exist on every string and array
- Failure returns 4xx with a stable error shape, not 500
