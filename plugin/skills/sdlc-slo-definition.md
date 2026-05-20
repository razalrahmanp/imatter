---
name: sdlc-slo-definition
description: Use when defining service-level objectives — picks the right SLIs (indicators), sets meaningful targets, and avoids vanity metrics that don't reflect user experience.
---

## Rule

An SLO is a numeric promise about user experience. Pick 2–4 indicators per service that reflect what users care about, set targets you can actually meet, and review monthly. Don't measure things you can't act on.

## SLI selection — what users actually feel

| Service shape | SLIs (pick 2–4) |
|---|---|
| Request/response (HTTP API) | Availability (success rate), Latency (p95/p99) |
| Async job (worker) | Throughput, Queue lag, Failure rate |
| Data pipeline | Freshness (time since last successful run), Completeness |
| Storage | Durability (rare incidents/year), Availability |
| Real-time (WebSocket, push) | Delivery rate, Delivery latency |

## Setting targets

| SLO type | Common starting points |
|---|---|
| Availability | 99.5% (achievable), 99.9% ("three nines"), 99.95%+ (expensive) |
| Latency p95 | < 200ms (snappy), < 500ms (acceptable), < 1s (laggy) |
| Latency p99 | 2–5× p95 typically |
| Freshness | "Data ≤ 15 min stale 95% of the time" |

Pick what you can actually hit *today* + 1 step better. Aspirational targets that you constantly miss are noise.

## Error budget

```
Error budget = (1 - SLO target) × time window
Example: 99.9% over 30 days = 0.1% × 30d = 43 minutes of downtime budget per month
```

When budget is consumed, freeze risky changes. When budget is healthy, ship more.

## Anti-patterns

- ❌ Defining SLOs by what your system already does ("we're 99.99% so the SLO is 99.99%") — leaves no slack
- ❌ Too many SLOs (>5 per service — operators tune out)
- ❌ SLOs nobody owns (review monthly with an owner)
- ❌ "Uptime" measured by ping — users don't ping; they make requests
- ❌ p50 latency as the headline (hides tail behavior)
- ❌ SLOs without error budget consequence (just numbers on a wiki)

## Gate criteria

- 2–4 SLOs documented per user-facing service
- Each SLO names the SLI, target, time window, owner
- Error budget is computed and visible
- Monthly review on calendar
- Burn-rate alerts (fast-burn 2%/1h, slow-burn 10%/6h)
