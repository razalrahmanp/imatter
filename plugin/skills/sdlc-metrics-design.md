---
name: sdlc-metrics-design
description: Use when instrumenting a new service or endpoint — covers the four metric types, the RED/USE methods, naming, label cardinality, and what to alert on.
---

## Rule

Every service exposes metrics. Use the four standard metric types correctly. Keep label cardinality low. Build dashboards from a small set of canonical metrics, not a sprawling per-feature collection.

## Four metric types — pick the right one

| Type | Use for | Example |
|---|---|---|
| **Counter** | Things that only go up | `requests_total`, `errors_total`, `bytes_received_total` |
| **Gauge** | Things that go up and down | `db_connections_active`, `queue_depth`, `memory_used_bytes` |
| **Histogram** | Distributions; for latency, sizes | `request_duration_seconds`, `response_size_bytes` |
| **Summary** | Pre-computed quantiles (rare) | Like histogram but computes percentiles client-side |

**Default to histograms** for any numeric value with a distribution. Counters and gauges for whole-number state.

## RED method — for request-driven services

| Letter | Metric | Why |
|---|---|---|
| **R**ate | Requests per second | Traffic level |
| **E**rrors | Error rate | Reliability |
| **D**uration | Latency distribution | Performance |

Three metrics. That's the baseline for any HTTP service. Everything else is supplementary.

## USE method — for resource-driven services (queues, workers, DBs)

| Letter | Metric | Why |
|---|---|---|
| **U**tilization | % of capacity in use | Saturation indicator |
| **S**aturation | Queued/blocked work | Backpressure signal |
| **E**rrors | Error rate | Failure rate |

## Naming — Prometheus convention

```
<namespace>_<subsystem>_<name>_<unit>

http_requests_total                 — counter (total suffix)
http_request_duration_seconds       — histogram (unit suffix)
db_connections_active               — gauge
queue_depth                         — gauge
fcm_send_total                       — counter
```

Use SI units (seconds, bytes), not custom (milliseconds, kilobytes). Aggregations are easier.

## Labels — keep cardinality low

```
http_requests_total{method="POST", route="/orders", status="200"}
                    ↑low          ↑low (parameterized)  ↑low (3-digit)
```

Label cardinality = the number of distinct label combinations. Each combination is a separate time series. **Keep total cardinality under ~10,000 per metric**, ideally much lower.

```
✅ Good labels (low cardinality):
   method (~5 values), route (~50), status (~10), service (~3)

❌ Bad labels (high or unbounded cardinality):
   user_id, order_id, email, request_id, IP address
```

If you need per-user data, use logs or traces — not metrics.

## What to alert on

| Symptom | Threshold (starting point) |
|---|---|
| Error rate spike | > 1% for 5 min |
| p99 latency degradation | > 2× baseline for 10 min |
| Queue depth growing unbounded | > 1000 and rising |
| Worker not consuming | Queue depth > 0 AND consumer rate ≈ 0 |
| Memory near limit | > 85% sustained 10 min |
| Disk filling | > 80%, > 90% urgent |
| Certificate expiring | < 30 days |
| Failed login spike | > 10× baseline |

Alert on **symptoms** (user-affecting), not causes. "Database query slow" might not need a page if the user-facing latency is still fine.

## Pattern — counter + histogram per endpoint

```ts
const requestsTotal = metrics.counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"],
});

const requestDuration = metrics.histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

// In middleware:
const end = requestDuration.startTimer({ method, route });
res.on("finish", () => {
  const status = res.statusCode.toString();
  requestsTotal.inc({ method, route, status });
  end({ status });
});
```

## Anti-patterns

- ❌ One metric per feature (`orders_create_total`, `orders_update_total`...) when one metric with a label would work
- ❌ Counter that resets (use a gauge or restart-resistant counter)
- ❌ Recording user IDs / emails / UUIDs as labels (cardinality explosion → cost explosion)
- ❌ Alerting on every metric variance (alert fatigue)
- ❌ p50 latency as the main SLO metric (hides bad tail behavior)
- ❌ Histograms with wrong bucket choice (no resolution where it matters)
- ❌ Custom names not following conventions (`requestCount`, `request-count`, `req_total`) — pick one

## Gate criteria

- Every service exposes RED metrics or USE metrics depending on its shape
- Latency is recorded as a histogram with buckets appropriate to the SLO
- Label cardinality is bounded; no user_id or request_id labels
- Naming follows the convention (snake_case, unit suffix where applicable)
- Alerts target user-affecting symptoms with documented thresholds
- A "golden dashboard" exists per service showing the canonical 3–6 metrics
