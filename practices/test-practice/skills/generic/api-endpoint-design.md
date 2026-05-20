---
id: api-endpoint-design
title: "API endpoint — JWT, request/response shape, error envelope"
layer: generic
tags: [api, jwt, auth, validation, http, rest]
applies_to:
  task_types: [add-endpoint, modify-endpoint, add-handler, add-route]
  stages: [3, 5, 6]
size_tokens: 260
related: [authn-pattern, input-validation, structured-logging]
---

# api-endpoint-design — API Endpoint Design Pattern

## Pattern Summary

Every endpoint follows the same four-step structure. No deviation.

```
1. Authenticate  — verify token/key first, before any other logic
2. Validate      — parse and validate input with a schema library (Zod, Joi, Pydantic)
3. Execute       — business logic or DB call (never raw I/O in handler)
4. Respond       — consistent envelope, never expose internals
```

**Standard response envelope (use across all endpoints):**
```json
// Success
{ "data": <result> }                          // 200 OK
{ "data": <created>, "id": "<id>" }           // 201 Created

// Client errors
{ "error": { "field": ["message"] } }         // 400 Bad Request
{ "error": "Unauthorized" }                    // 401
{ "error": "Not found" }                       // 404

// Server errors — never expose stack traces or query text
{ "error": "Internal server error" }           // 500
```

**Status code rules:**
- `400` — malformed input (fail schema validation)
- `401` — token missing or invalid
- `403` — token valid but insufficient permissions
- `404` — resource not found for this authenticated user
- `409` — conflict (duplicate, optimistic lock failure)
- `500` — unexpected error; log with correlation ID, return opaque message

**Authentication first — hardcoded rule:**
```
// NEVER
if (someCondition) { verifyToken(); }

// ALWAYS — auth is unconditional
const claims = verifyToken(request.headers.authorization);
if (!claims) return 401;
```

**Input validation — always at the boundary:**
Validate before touching DB or calling any service. Reject early, fail fast.

## Full Reference

### CORS
Set CORS headers at the gateway/proxy layer, not inside handler code.

### Versioning
Use URL versioning (`/v1/orders`) for major breaking changes.
Use header versioning (`API-Version: 2`) for non-breaking feature flags.
See `api-versioning` skill for full lifecycle.

### Forbidden
- Returning stack traces in error responses
- Optional authentication (every endpoint is authed or it doesn't exist)
- Logging full request body (may contain PII)
- Catching all errors silently (`catch {}` with no re-throw or log)
