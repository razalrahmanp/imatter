---
id: input-validation
title: "Input validation — validate at trust boundaries, never inside"
layer: generic
tags: [validation, security, input, zod, pydantic, schema]
applies_to:
  task_types: [add-endpoint, add-worker, add-handler, add-queue-consumer]
  stages: [3, 6]
size_tokens: 230
related: [api-endpoint-design, error-handling, pii-handling]
---

# input-validation — Input Validation at Trust Boundaries

## Pattern Summary

Validate at every trust boundary: API entry, queue message, webhook payload, config at startup. Never inside business logic.

```
Trust boundaries that ALWAYS need validation:
  ✓ HTTP request body / query params
  ✓ Queue/stream message body (SQS, Kafka, PubSub)
  ✓ Webhook payload from external service
  ✓ Environment variables / config at cold start
  ✗ Internal function calls between known-typed modules — not needed
```

**Always safeParse (not parse) in request path:**
```typescript
const parsed = RequestSchema.safeParse(rawInput);
if (!parsed.success) {
  return { statusCode: 400, body: JSON.stringify({ error: parsed.error.flatten() }) };
}
// After this line, TypeScript knows the exact shape — no casting needed
const { field1, field2 } = parsed.data;
```

**Schema at module level — not inside the handler:**
```typescript
// TOP of file — defines contract, enables reuse in tests
const CreateOrderSchema = z.object({
  table_id:  z.string().uuid(),
  items:     z.array(ItemSchema).min(1).max(50),
  notes:     z.string().max(200).optional(),
});
```

**Environment config validation at cold start (fail fast):**
```typescript
// Throws at startup if env is misconfigured — intentional, not a bug
export const config = z.object({
  DB_URL:    z.string().url(),
  API_KEY:   z.string().min(20),
  NODE_ENV:  z.enum(["development", "staging", "production"]),
}).parse(process.env);
```

## Full Reference

### Schema composition (reuse leaf validators)
Define shared leaf schemas in a shared module and import; don't redefine `z.string().uuid()` in every handler.

### Forbidden
- `JSON.parse(body)` without schema validation
- Casting `(body as MyType)` without parsing
- `z.any()` as a schema — defeats the purpose
- `parse()` in request path — throws raw errors, breaks error handling
