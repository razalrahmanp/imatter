---
id: error-handling
title: "Error handling — typed errors, never swallow, log once, propagate context"
layer: generic
tags: [error-handling, typescript, logging, exceptions, reliability]
applies_to:
  task_types: [add-handler, add-endpoint, add-worker, any]
  stages: [3, 5]
size_tokens: 200
related: [structured-logging, input-validation, api-endpoint-design]
---

# error-handling — Error Handling Pattern

## Pattern Summary

Errors fall into three categories: user errors (4xx), system errors (5xx), and unexpected exceptions. Handle each differently. Never silently swallow an error.

**Typed error classes:**
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,       // machine-readable: "order_not_found"
    public readonly statusCode: number, // HTTP status
    public readonly details?: unknown   // optional structured context
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found`, `${resource}_not_found`, 404, { id });
  }
}

export class ValidationError extends AppError {
  constructor(message: string, fields: Record<string, string>) {
    super(message, "validation_error", 400, { fields });
  }
}
```

**Lambda error handler (top-level catch):**
```typescript
export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    return await routeRequest(event);
  } catch (err) {
    if (err instanceof AppError) {
      // Known error — log at warn level, return structured response
      logger.warn("request_error", { code: err.code, statusCode: err.statusCode });
      return { statusCode: err.statusCode, body: JSON.stringify({ code: err.code, message: err.message }) };
    }
    // Unknown error — log at error level with full stack
    logger.error("unhandled_error", { err });
    return { statusCode: 500, body: JSON.stringify({ code: "internal_error", message: "An unexpected error occurred" }) };
  }
};
```

## Full Reference

### Never swallow
```typescript
// FORBIDDEN — swallowed error
try { await doThing(); } catch (_) {}

// OK — explicit decision to ignore a known non-fatal case
try { await cache.set(key, val); } catch (err) {
  logger.warn("cache_write_failed", { key, err }); // still logged
}
```

### Log once
Log errors at the boundary where they become unhandled. Don't log inside a helper AND at the handler level — duplicate logs obscure the signal.

### Forbidden
- `catch (err) { return null; }` without logging
- Returning 200 with an error payload (use the correct HTTP status code)
- Leaking stack traces or internal error details to the API response body
