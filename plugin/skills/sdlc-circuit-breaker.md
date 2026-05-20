---
name: sdlc-circuit-breaker
description: Use when calling an external dependency whose failure could cascade — opens after repeated failures to stop hammering and let the dependency recover.
---

## Rule

When a downstream dependency is failing, continuing to call it makes things worse: it wastes your resources, prolongs the dependency's outage, and inflates user-facing latency. A circuit breaker watches recent calls; after enough failures, it "opens" and rejects calls immediately for a cool-down period.

## States

```
CLOSED   → calls flow through; failures counted
   │
   │ (failure threshold hit)
   ▼
OPEN     → calls rejected immediately; no traffic to dependency
   │
   │ (cool-down elapses)
   ▼
HALF_OPEN → limited trial calls allowed; success → CLOSED, failure → OPEN
```

## Pattern

```ts
class CircuitBreaker {
  private state: "closed" | "open" | "half_open" = "closed";
  private failures = 0;
  private nextProbeAt = 0;

  constructor(private opts: {
    threshold: number;        // failures before opening (e.g. 5)
    coolDownMs: number;       // OPEN → HALF_OPEN delay (e.g. 30_000)
  }) {}

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() < this.nextProbeAt) {
        throw new CircuitOpenError("circuit open");
      }
      this.state = "half_open";
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= this.opts.threshold || this.state === "half_open") {
      this.state = "open";
      this.nextProbeAt = Date.now() + this.opts.coolDownMs;
    }
  }
}

// One breaker per dependency:
const stripeBreaker = new CircuitBreaker({ threshold: 5, coolDownMs: 30_000 });

await stripeBreaker.call(() => stripe.charges.create(...));
```

## Tuning by call site

| Dependency type | threshold | coolDownMs | Notes |
|---|---|---|---|
| Critical sync (payment, auth) | 3 | 5000 | Recover fast; users blocked |
| Async backend (search, analytics) | 5 | 30_000 | Tolerate brief blip; longer cool-down ok |
| Best-effort (recommendations, related items) | 10 | 60_000 | Tolerate more; fall back to placeholder |

## Pair with fallback / graceful degradation

A circuit breaker without a fallback just turns failures into faster failures. Pair each breaker with:
- A cached "last good" value
- A reduced-feature path ("trending items" instead of "personalized recommendations")
- A clear user-facing message
- A status code your callers can degrade on

See [[sdlc-graceful-degradation]] for the fallback patterns.

## Observability

```ts
logger.warn("circuit opened", {
  dependency: "stripe",
  failures: 5,
  threshold: 5,
  next_probe_at: this.nextProbeAt,
});

metrics.gauge("circuit_state", state === "open" ? 1 : 0, { dependency });
```

Alert on `circuit_state == 1` (open) for any critical dependency. Don't alert on transient blips; alert on sustained open state (>5 minutes).

## Anti-patterns

- ❌ One global circuit breaker for all dependencies (one bad dependency takes down everything)
- ❌ Circuit breaker without a fallback (faster failures, no value)
- ❌ Threshold = 1 (any blip opens — too aggressive)
- ❌ Cool-down = 0 (no cool-down; just instant retry — useless)
- ❌ Open state silent — no alerting, no metric
- ❌ Breaker state stored per-instance with many app instances (each goes through learning phase — coordinate via Redis if cross-instance recovery matters)
- ❌ Breaker on database connection pool (the pool already does this; double layer adds bugs)

## Gate criteria

- Every external HTTP call to a critical dependency goes through a circuit breaker
- Each breaker has its own threshold and cool-down tuned to that dependency
- Open-state events are logged at WARN with the dependency name
- A metric/gauge exists for breaker state per dependency
- Alerts fire on sustained open state, not on transient blips
- Each breaker is paired with a documented fallback strategy
