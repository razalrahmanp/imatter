# structured-logging — JSON Logging Pattern

## Pattern Summary

All logs are JSON objects with a correlation ID. Never use bare `console.log("string")`.

```typescript
// src/shared/logger.ts
export function log(level: "info" | "warn" | "error", event: Record<string, unknown>): void {
  console[level](JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    correlationId: getCurrentCorrelationId(),  // set per-request, see below
    ...event,
  }));
}

// Usage in Lambda handler — set correlation ID at the top of every handler
import { log, setCorrelationId } from "../../shared/logger";

export const handler = async (event: APIGatewayProxyEvent) => {
  setCorrelationId(event.requestContext?.requestId ?? crypto.randomUUID());

  log("info", { action: "order.create.start", stage: 1 });

  // ... handler logic ...

  log("info", { action: "order.create.complete", orderId: result.id });
};
```

**Allowed log fields:**
```typescript
// OK — operational metadata only
log("info", { action: "payment.verify", paymentId: "pay_abc123", status: "success" });
log("error", { action: "db.query.fail", errorId: crypto.randomUUID(), kind: "timeout" });

// NEVER — PII in logs
log("info", { customerEmail: "...", orderItems: [...], tableId: "...", token: "..." });
```

## Full Reference

### Correlation ID propagation
```typescript
// src/shared/logger.ts
import { AsyncLocalStorage } from "async_hooks";

const storage = new AsyncLocalStorage<{ correlationId: string }>();

export function setCorrelationId(id: string): void {
  storage.enterWith({ correlationId: id });
}

export function getCurrentCorrelationId(): string {
  return storage.getStore()?.correlationId ?? "no-correlation-id";
}
```

### Log levels
| Level | When to use |
|-------|-------------|
| `info` | Request start/end, significant state transitions |
| `warn` | Recoverable anomalies (retry, fallback used) |
| `error` | Failures that need investigation (always include `errorId`) |

### Never log
- Customer email, phone, name
- Order item contents (may contain allergy/diet info = sensitive)
- Session tokens, JWT claims, API keys
- SQL query text or parameters (may contain PII)
- Razorpay payment amounts or card details

### CloudWatch Insights query pattern
```
fields @timestamp, level, action, correlationId, errorId
| filter level = "error"
| sort @timestamp desc
| limit 50
```
