---
name: sdlc-timeout-budgets
description: Use when implementing any synchronous request path that calls downstream services — assigns a timeout budget per leg so total latency stays predictable and slow dependencies cannot hang user requests.
---

## Rule

Every synchronous request has a total time budget. Every leg of that request (auth check, DB query, downstream call) has its own sub-budget. The sum of leg budgets is less than the total budget, with margin for the response itself.

## Pattern — budget tree

```
Total request budget: 2000 ms
├─ Auth verification: 100 ms
├─ DB read (main): 200 ms
├─ Downstream API (Stripe): 500 ms
│   ├─ HTTP timeout: 400 ms
│   └─ Slack on remaining 100 ms
├─ Business logic + response serialization: 200 ms
└─ Margin for slow tail: 1000 ms
```

The "margin" exists because most tail-latency events are due to one leg taking longer than expected. Without a margin, a single slow leg fails the whole request even if the budget summed up to total.

## Implementation — `AbortSignal`

```ts
async function callDownstream<T>(fn: (signal: AbortSignal) => Promise<T>, budgetMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), budgetMs);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

// Use:
const stripeResult = await callDownstream(
  signal => fetch("https://api.stripe.com/...", { signal }),
  500
);
```

For DB clients, set `statement_timeout` per query:

```sql
SET LOCAL statement_timeout = '200ms';
```

## Don't trust client-supplied deadlines blindly

A client sending `Request-Timeout: 5000ms` is a hint, not law. The server's own budgets still apply. Use the *smaller* of (client deadline, server budget) per leg.

## Budget tracking through hops

For microservices, the upstream's remaining budget informs the downstream:

```ts
const upstreamDeadline = req.headers["x-deadline-ms"];
const myBudget = Math.min(Number(upstreamDeadline) ?? Infinity, MY_DEFAULT_BUDGET);
```

OpenTelemetry conventions include deadline propagation; use the OTel SDK if you have it.

## Anti-patterns

- ❌ No timeout on `fetch`, DB queries, or downstream calls (default Node `fetch` has no timeout — hangs forever on connection lost)
- ❌ A single global timeout for the whole request (one slow leg burns it all)
- ❌ Setting a 30s downstream timeout for a 2s user request (downstream hangs all the way to the global timeout)
- ❌ Cascading retries that exceed the budget (3 retries × 5s timeout = 15s on a 2s budget)
- ❌ "Just in case" budgets that allow 60s+ for sync request paths (real users abandon at ~3s)
- ❌ Statement timeouts on DB connection level rather than per-query (kills long-running admin queries too)

## Gate criteria

- Every external call has an explicit timeout (HTTP timeout, AbortSignal, or equivalent)
- The total of per-leg budgets is less than total request budget with documented margin
- DB queries have per-query `statement_timeout` set (where the DB supports it)
- p99 latency is monitored per endpoint and alertable
- A circuit breaker pattern (see [[sdlc-circuit-breaker]]) sits in front of any leg that frequently exceeds its budget
