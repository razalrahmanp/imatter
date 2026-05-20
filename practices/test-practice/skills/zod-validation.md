# zod-validation — Input Validation at Trust Boundaries

## Pattern Summary

Validate at every trust boundary: Lambda entry, SQS message body, external webhook. Never trust input structure.

```typescript
import { z } from "zod";

// Define schema at module level — not inside the handler
const CreateOrderSchema = z.object({
  table_id: z.string().uuid({ message: "table_id must be a valid UUID" }),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    quantity: z.number().int().positive().max(99),
    notes: z.string().max(200).optional(),
  })).min(1, { message: "Order must have at least one item" }).max(50),
});

// In handler — always safeParse, never parse
const parsed = CreateOrderSchema.safeParse(JSON.parse(event.body ?? "{}"));
if (!parsed.success) {
  return {
    statusCode: 400,
    body: JSON.stringify({ error: parsed.error.flatten() }),
  };
}

// After this point, TypeScript knows the exact shape
const { table_id, items } = parsed.data;
```

**Schema composition — reuse leaf schemas:**
```typescript
// src/shared/schemas.ts — common leaf validators
export const UuidSchema = z.string().uuid();
export const BranchIdSchema = z.string().uuid();
export const PaginationSchema = z.object({
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});
```

## Full Reference

### Trust boundaries (validate at ALL of these)
- Lambda `event.body` — always JSON.parse + schema
- SQS `record.body` — JSON.parse + schema
- Webhook payloads (Razorpay, FCM) — validate before reading fields
- Environment variables — validate at cold start with `z.string().min(1)`

### Environment variable validation (cold-start guard)
```typescript
// src/shared/config.ts — run once at module load time
const EnvSchema = z.object({
  DB_SECRET_ARN:     z.string().min(1),
  COGNITO_USER_POOL: z.string().min(1),
  AWS_REGION:        z.string().min(2),
});

export const config = EnvSchema.parse(process.env);
// Throws on cold start if env is misconfigured — fail fast, don't fail silently
```

### Rules
- Schema at module level — not inline in handler (enables reuse + testing)
- `safeParse` in request path — never `parse` (parse throws, breaks error handling)
- `parse` acceptable in config validation — throws at cold start intentionally
- Never access `event.body.someField` before parsing — TypeScript allows it but it's unsafe
- `.flatten()` on error — client gets field-level messages, not internal stack traces

### Forbidden
- `JSON.parse(event.body)` without schema validation
- `(event.body as MyType).field` — casting without validation
- `z.any()` as a schema — defeats the purpose
