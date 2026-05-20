---
name: sdlc-structured-logging
description: Use when adding logging to any service — covers JSON log structure, the standard field names, log levels, and the PII rules for what must never appear in logs.
---

## Rule

Logs are JSON, not free-form strings. Every entry has the same baseline fields. Levels mean specific things. PII never appears.

## Standard structure

```json
{
  "level": "info",
  "ts": "2026-05-20T10:30:00.123Z",
  "msg": "order created",
  "service": "orders-api",
  "request_id": "req_01H...",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "user_id": "usr_abc123",
  "tenant_id": "tnt_xyz789",
  "route": "POST /orders",
  "order_id": "ord_def456",
  "duration_ms": 42
}
```

Required on every entry: `level`, `ts`, `msg`, `service`.
Required on every request-scoped entry: `request_id` (so a request's logs can be grouped).

## Levels — what each means

| Level | When |
|---|---|
| `trace` / `debug` | Local development only; turn off in prod by default. Use for noisy diagnostics. |
| `info` | Notable but expected events: request received, order placed, job started. Should be parseable as a timeline. |
| `warn` | Recoverable problem: transient downstream error after retry, slow query, rate-limit hit. Not user-impacting yet. |
| `error` | User-impacting failure: 5xx returned, job permanently failed, alert-worthy. Each error log entry should be actionable. |
| `fatal` | Process is about to die. Rare — usually for startup failures. |

If your prod is generating more than a handful of `error` entries per minute steady-state, your levels are wrong — those are likely `warn`.

## Standard field names — use these, not your own

| What | Field |
|---|---|
| Request correlation | `request_id` (alias: `req_id`) |
| W3C trace context | `trace_id`, `span_id`, `parent_span_id` |
| Authenticated user (internal ID, not PII) | `user_id` |
| Tenant (multi-tenant systems) | `tenant_id` |
| HTTP method + path | `route` (e.g. `"POST /orders"`) |
| HTTP status | `status` |
| Wall-clock duration | `duration_ms` |
| Error code (machine) | `err_code` |
| Error message | `err_message` |
| Error stack | `err_stack` |
| Operation type | `op` |
| Affected resource | `<resource>_id` (e.g. `order_id`, `payment_id`) |

Don't invent `userid`, `userId`, `user`, `uid` — pick one (`user_id`) and use it everywhere.

## What NEVER goes in logs

| Forbidden | Why |
|---|---|
| Email address | PII (see [[sdlc-pii-handling]]) |
| Phone number | PII |
| Full name | PII |
| Card number, even masked (use `card_last4` only) | PCI scope |
| Password (even hashed) | Obvious |
| Bearer tokens, API keys, session cookies | Credential leak |
| Raw request body on auth endpoints | Contains password |
| Full request body in general | Likely contains PII |
| Stack traces that include user input as locals | Sentry beforeSend should strip |
| FCM tokens, push tokens | Credential-like |
| Razorpay VPA, card_id, contact, email fields | See [[sdlc-razorpay-webhook]] |

## Pattern — never log the user object

```ts
// ❌ Wrong — logs name + email
logger.info("user signed in", { user });

// ✅ Right — log safe internal IDs
logger.info("user signed in", { user_id: user.id, tenant_id: user.tenant_id });
```

## Sampling

For high-cardinality logs (every request, every cache hit), sample. Keep all `error` and `warn`, sample `info` at 1–10%.

```ts
if (level === "info" && Math.random() > 0.1) return;
```

Tag sampled logs with `sampled: true` so consumers know the count is partial.

## Anti-patterns

- ❌ `console.log` in production code (no level, no structure)
- ❌ String concatenation in messages (`"user " + email + " did X"`) — leaks PII and breaks searchability
- ❌ `logger.error` for expected business outcomes ("out of stock") — pollutes alerting
- ❌ Logging both the request and response of the same call (one entry per logical event)
- ❌ Logging inside a tight loop without sampling
- ❌ Different field names for the same concept (`uid` here, `user_id` there) — unsearchable

## Gate criteria

- All logs are structured JSON (no free-form `console.log`)
- Every log entry has `level`, `ts`, `msg`, `service`
- Every request-scoped log has `request_id`
- A `mask` utility is imported and used at every site where PII could enter a log (grep for `email`, `phone`, etc. in `logger.*` args — should be 0 hits)
- W3C trace context (`trace_id`, `span_id`) is on every log entry inside a traced span
- Error rate (count of `error` entries per minute) is on a dashboard and alertable
