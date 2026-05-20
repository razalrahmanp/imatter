---
id: structured-logging
title: "Structured logging — JSON shape, correlation IDs, log levels"
layer: generic
tags: [observability, logging, json, correlation-id, cloudwatch]
applies_to:
  task_types: [add-endpoint, add-worker, add-handler, modify-handler]
  stages: [8]
size_tokens: 220
related: [pii-handling, distributed-tracing, metrics-design]
---

# structured-logging — JSON Logging Pattern

## Pattern Summary

All logs are JSON objects with a correlation ID. Never use bare `console.log("string")`.

```typescript
// Every log call is a structured object — never a bare string
log("info",  { action: "order.create.start",    orderId: "ord_abc" });
log("warn",  { action: "payment.retry",          attempt: 2, maxAttempts: 3 });
log("error", { action: "db.query.fail",          errorId: crypto.randomUUID(), kind: "timeout" });

// Set correlation ID once at the top of each request/message handler
setCorrelationId(request.headers["x-request-id"] ?? crypto.randomUUID());
```

**Log levels:**
| Level | When |
|-------|------|
| `info` | Request start/end, state transitions |
| `warn` | Recoverable anomalies (retry, fallback) |
| `error` | Failures needing investigation — always include `errorId` |

**Never log:**
- Customer email, phone, name, or any free-text input
- SQL query text or parameters (may contain PII)
- Session tokens, JWT claims, API keys, or secrets
- Full request/response bodies

**Correlation ID propagation (AsyncLocalStorage pattern):**
```typescript
import { AsyncLocalStorage } from "async_hooks";
const storage = new AsyncLocalStorage<{ correlationId: string }>();

export const setCorrelationId = (id: string) => storage.enterWith({ correlationId: id });
export const getCorrelationId = () => storage.getStore()?.correlationId ?? "no-correlation-id";
```

## Full Reference

### Log shape (every log includes these fields)
```json
{
  "timestamp": "2026-05-20T12:00:00.000Z",
  "level": "info",
  "correlationId": "req_abc123",
  "action": "order.create.complete",
  "orderId": "ord_xyz789"
}
```

### CloudWatch Insights query
```
fields @timestamp, level, action, correlationId, errorId
| filter level = "error"
| sort @timestamp desc
| limit 50
```
