# api-endpoint — API Gateway + Lambda Endpoint Pattern

## Pattern Summary

Every new endpoint follows this registration and validation contract.

**Handler file location:** `src/functions/{domain}/handler.ts`
**One handler file per domain** — no cross-domain imports.

**Input validation with Zod (required at every entry point):**
```typescript
import { z } from "zod";

const CreateOrderSchema = z.object({
  table_id: z.string().uuid(),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

// In handler — always safeParse, never parse
const parsed = CreateOrderSchema.safeParse(JSON.parse(event.body ?? "{}"));
if (!parsed.success) {
  return { statusCode: 400, body: JSON.stringify({ error: parsed.error.flatten() }) };
}
const { table_id, items } = parsed.data;
```

**Response shape (consistent across all endpoints):**
```typescript
// Success
{ statusCode: 200, body: JSON.stringify({ data: result }) }
{ statusCode: 201, body: JSON.stringify({ data: created, id: created.id }) }

// Client errors
{ statusCode: 400, body: JSON.stringify({ error: { field: ["message"] } }) }
{ statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) }
{ statusCode: 404, body: JSON.stringify({ error: "Not found" }) }

// Server errors — never expose internals
{ statusCode: 500, body: JSON.stringify({ error: "Internal server error" }) }
```

**CORS headers** — set in API Gateway, not in Lambda. Never add CORS headers in handler code.

**Auth guard** — always the first line. See `lambda-handler` skill for the full pattern.

## Full Reference

### Domain structure
```
src/functions/orders/
  handler.ts          ← exports { handler }
  __tests__/
    orders.test.ts    ← integration tests against real DB
```

### Forbidden in handlers
- Raw `console.log` with user data
- Importing from another domain's folder (`../payments/`)
- Returning stack traces or query text in error responses
- Optional auth — every handler is authenticated or it is not a handler
