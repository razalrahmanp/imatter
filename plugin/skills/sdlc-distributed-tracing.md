---
name: sdlc-distributed-tracing
description: Use when instrumenting a multi-service system or a request path that touches several backends — explains W3C trace context, span naming, and what to instrument vs. skip.
---

## Rule

A trace follows a single logical request across services. Each unit of work is a span. Spans nest. Use W3C trace context (`traceparent`, `tracestate`) — not a custom header — so trace IDs propagate across language and library boundaries.

## Concepts

| Term | Meaning |
|---|---|
| **Trace** | The whole request from start to finish |
| **Span** | One unit of work within the trace (DB query, HTTP call, computation) |
| **Trace ID** | 16-byte ID identifying the trace; same across all spans |
| **Span ID** | 8-byte ID identifying one span |
| **Parent span ID** | Links a span to its parent (forms a tree) |

## Pattern — W3C trace context header

Every HTTP request and response carries `traceparent`:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              ↑   ↑                                ↑                 ↑
              │   trace_id                          span_id           flags (01 = sampled)
              version
```

When service A calls service B:
- A creates a child span, computes a new `span_id`, keeps the original `trace_id`
- A sends `traceparent` with its own `span_id` as the parent
- B reads `traceparent`, creates its span with that as parent

## What to instrument

| Instrument | Why |
|---|---|
| HTTP servers (incoming) | Entry point of trace |
| HTTP clients (outgoing) | Cross-service propagation |
| DB queries | Often the slow leg |
| Cache hits/misses | Pinpoint stale or thrashing caches |
| Queue produce/consume | Distributed async workflows |
| External APIs (Stripe, OpenAI, etc.) | Vendor latency is often the bottleneck |

What NOT to instrument (too noisy):
- Every function call
- Every loop iteration
- Pure computations under 1 ms

## Span naming — operation, not URL

```
✅ GET /orders/:id              ← parameterized
✅ db.query.SELECT.orders       ← operation + table
✅ stripe.charges.create        ← vendor + action

❌ GET /orders/12345            ← cardinality blowup; one tag per ID
❌ "fetch user"                  ← too generic; can't group
❌ user.repository.findById(12345)
```

Span name should be: low-cardinality, hierarchically grouped, descriptive enough to find quickly in the UI.

## Attributes — what to attach to a span

```ts
span.setAttributes({
  "http.method": "POST",
  "http.target": "/orders",
  "http.status_code": 201,
  "db.system": "postgresql",
  "db.statement": "INSERT INTO orders ...",      // careful — may contain PII
  "user.id": userId,                              // safe — internal ID
  // never: req.body, password, PII
});
```

Use OpenTelemetry semantic conventions where they exist — saves your future self from re-naming everything.

## Sampling

Tracing every request is expensive (storage + processing). Sample:

- **Head sampling**: decide at trace start whether to keep it; cheap but loses important traces
- **Tail sampling**: keep all traces in memory briefly; decide based on outcome (kept if error or slow); more accurate but needs a collector

For most apps: head-sample at 10% for normal traffic, 100% for errors and slow requests (via dynamic sampling rules).

## Anti-patterns

- ❌ Custom `X-Trace-Id` header (incompatible with other tools; W3C is standard)
- ❌ Span names with high cardinality (URLs with IDs, query strings, user emails)
- ❌ Logging instead of tracing for multi-service flows (logs don't link automatically)
- ❌ Tracing every internal function (storage blowup; UI noise)
- ❌ Attaching the full request body as a span attribute (PII + storage)
- ❌ Not propagating trace context through queues (async work loses parent)
- ❌ Sampling at the head only when errors should always be traced

## Gate criteria

- HTTP servers and clients propagate `traceparent` header
- Every span has `trace_id` + `span_id` recorded; logs include them as fields
- Span names are low-cardinality (parameterized)
- DB queries are spanned (auto-instrumentation via the SDK)
- A dashboard exists showing trace flame graphs for slow requests
- Errors and slow requests are always sampled (overriding head sample rate)
