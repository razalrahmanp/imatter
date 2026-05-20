---
name: sdlc-api-endpoint-design
description: Use when designing any new HTTP endpoint — covers URL shape, HTTP verb, request/response schemas, status codes, pagination, and the consistency rules that compound across an API.
---

## Rule

API design choices compound. The 50th endpoint inherits the conventions of the first one. Get them consistent early, and document the conventions; let the codebase enforce them later.

## URL shape — resource-oriented

```
GET    /orders              list
POST   /orders              create
GET    /orders/{id}         read
PUT    /orders/{id}         replace
PATCH  /orders/{id}         partial update
DELETE /orders/{id}         delete

GET    /orders/{id}/items   sub-resource list
POST   /orders/{id}/items   sub-resource create
```

| Rule | Why |
|---|---|
| Plural nouns for collections (`/orders`, not `/order`) | Consistent grammar |
| Lowercase, kebab-case if multi-word (`/user-profiles`) | URL-safe; matches HTTP conventions |
| No verbs in paths (use HTTP verb) | Stays RESTful |
| Exceptions for clear action verbs (`/orders/{id}/cancel`) | Pragmatism > purism when the action doesn't map cleanly |
| Tenant-scoped paths if relevant (`/tenants/{tid}/orders/{id}`) | Makes tenant scope explicit; pair with token-derived tenant check |

## HTTP verbs — what each guarantees

| Verb | Semantics | Idempotent | Safe (no side effect) |
|---|---|---|---|
| GET | Read | Yes | Yes |
| HEAD | Headers only | Yes | Yes |
| OPTIONS | CORS / capabilities | Yes | Yes |
| POST | Create or "do something" | No | No |
| PUT | Full replace | Yes | No |
| PATCH | Partial update | Yes (if you do it right) | No |
| DELETE | Remove | Yes | No |

Idempotent verbs can be safely retried by clients. POST cannot — pair POST mutations with [[sdlc-idempotency-keys]] if retries are possible.

## Status codes — pick from a small set

| Range | When |
|---|---|
| 200 OK | Success with body |
| 201 Created | POST success; include `Location` header |
| 204 No Content | Success without body (typical for DELETE) |
| 400 Bad Request | Schema validation failure |
| 401 Unauthorized | Not authenticated |
| 403 Forbidden | Authenticated but not authorized |
| 404 Not Found | Resource doesn't exist (or exists but actor can't see it) |
| 409 Conflict | State conflict (e.g. version mismatch, duplicate key) |
| 410 Gone | Resource permanently removed (rare; use for soft-deleted) |
| 422 Unprocessable Entity | Schema parses but business rules reject (some teams use 400 for this — pick one and stick with it) |
| 429 Too Many Requests | Rate limited; include `Retry-After` |
| 500 Internal Server Error | Bug — should be alerting |
| 502/503/504 | Upstream/dependency failures |

Don't invent your own codes. Don't use 200 with `{ "error": "..." }` — make the status code itself the signal.

## Request/response schemas

- Every endpoint has a typed schema for input and output (Zod, Pydantic, OpenAPI)
- Schemas live alongside the handler — single source of truth
- Generate OpenAPI from schemas, not by hand
- Unknown fields rejected on input ([[sdlc-input-validation]])

## Pagination — pick one and stick to it

| Strategy | When | Trade-off |
|---|---|---|
| **Cursor-based** (`?cursor=...&limit=20`) | Most cases | Stable across inserts; can't jump to arbitrary page |
| **Offset/limit** (`?offset=40&limit=20`) | Small datasets only | Simple; breaks when items insert during pagination |
| **Page/per_page** (`?page=3&per_page=20`) | Legacy / external compatibility | Same as offset, just renamed |

Use cursor pagination by default. Response shape:

```json
{
  "data": [...],
  "next_cursor": "eyJpZCI6MTIzNDV9",
  "has_more": true
}
```

Limit `limit` to a sane cap (100, 200, 500 depending on row size). Reject larger values.

## Error response shape — consistent

```json
{
  "error": "validation_failed",
  "message": "Field 'email' must be a valid email address.",
  "details": { "field": "email", "value_received": null },
  "request_id": "req_01H..."
}
```

| Field | Purpose |
|---|---|
| `error` | Machine code (snake_case enum-like) |
| `message` | Human-readable; safe to display |
| `details` | Optional, structured context |
| `request_id` | Echo back for support to look up logs |

## Versioning

Pick one strategy:

| Strategy | Pros | Cons |
|---|---|---|
| URL prefix (`/v1/orders`, `/v2/orders`) | Visible, easy to route | Breaking changes require co-deploying two versions |
| Header (`Accept: application/vnd.api+json; version=2`) | URL stays clean | Caching is harder; harder to test in browser |
| No versioning, only additive changes | Simplest | Constrains design |

Most teams default to URL prefix. See [[sdlc-api-versioning]] (forthcoming) for deprecation policy.

## CORS, CSRF, content type

- Set `Content-Type: application/json` on every JSON response
- `Cache-Control: no-store` for authenticated responses (default safe)
- Enforce CORS at the gateway — never `Access-Control-Allow-Origin: *` for credentialed requests
- For cookie-auth APIs, require a CSRF token on state-changing requests OR use `SameSite=Lax` cookies + double-submit pattern

## Anti-patterns

- ❌ Mixing singular and plural (`/order` here, `/orders` there)
- ❌ Putting filters in the URL path (`/orders/active`) when query params are more flexible (`/orders?status=active`)
- ❌ Inventing `420 Enhance Your Calm`-style status codes
- ❌ Wrapping data in `data` only sometimes — be consistent (every response, or never)
- ❌ Returning 200 with `{ "success": false }` (defeat the purpose of HTTP codes)
- ❌ Allowing arbitrarily large `limit` values (DoS vector)
- ❌ Different pagination strategies on different endpoints
- ❌ Verbose tenant IDs in every URL when the token already carries them
- ❌ Trailing slashes inconsistent (`/orders/` vs `/orders` — pick one, redirect the other)

## Gate criteria

- A single conventions document exists (in `docs/api.md` or similar) covering URL shape, status codes, error shape, pagination
- Every new endpoint has a request schema and a response schema in code, not just in docs
- OpenAPI spec is generated, not hand-maintained
- A linter or test fails when a new endpoint violates the conventions (path casing, missing schema, missing pagination)
- Error responses across endpoints follow the same shape
