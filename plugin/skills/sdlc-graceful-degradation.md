---
name: sdlc-graceful-degradation
description: Use when designing user-facing features that depend on optional or unreliable services — covers fallback patterns so the core experience survives when peripherals fail.
---

## Rule

A user-facing feature is composed of a critical path (core experience) and peripherals (recommendations, related items, personalization, AI suggestions). When peripherals fail, the critical path must still work. Design the fallback at each peripheral boundary.

## Pattern — every peripheral has a fallback

```ts
async function getProductPage(productId: string) {
  const [product, recommendations, reviews] = await Promise.allSettled([
    db.products.findById(productId),            // critical
    getRecommendations(productId),              // peripheral
    getReviews(productId),                       // peripheral
  ]);

  if (product.status === "rejected") {
    throw product.reason; // critical path can fail the whole response
  }

  return {
    product: product.value,
    recommendations: recommendations.status === "fulfilled"
      ? recommendations.value
      : [],                                      // fallback: empty list
    reviews: reviews.status === "fulfilled"
      ? reviews.value
      : { items: [], degraded: true },           // fallback: signal degradation
  };
}
```

`Promise.allSettled` instead of `Promise.all` is the lever: one peripheral failure does not cascade.

## Fallback strategies by data type

| Data type | Fallback options (in order of preference) |
|---|---|
| List of items (recommendations, related, trending) | Cached "last good" → static top-N → empty list |
| Single value (price, availability) | Cached "last good" → conservative default → null + flag |
| Search results | Cached top searches → keyword-only mode → empty + message |
| AI/LLM output (suggestion, summary) | Cached prior output → template-based fallback → omit feature |
| Image/asset (avatar, thumbnail) | Cached version → placeholder → first-letter avatar |
| Auth provider (OAuth) | Email/password fallback (if enabled) → error with retry |
| Translation/i18n | Source language → key string → translation key as text |

## Signal degradation to the user

Don't silently fall back. Tell the user (or at minimum, log + tag):

```json
{
  "data": [...],
  "degraded": true,
  "degraded_reason": "recommendations_unavailable",
  "request_id": "req_..."
}
```

Or in the UI: "We're having trouble loading recommendations — try refreshing."

This matters because:
- Users blame the whole feature when something silently goes wrong
- Support can correlate user reports to actual outages
- Product can measure how often a feature is degraded

## Pair with circuit breakers

A graceful fallback is the *behaviour*; a [[sdlc-circuit-breaker]] is the *mechanism* that triggers it faster. When a dependency is failing, the breaker opens, the fallback fires instantly instead of after a timeout.

## Anti-patterns

- ❌ Fallback that calls another flaky service (chain of degradation)
- ❌ Silently swallowing the error and returning empty (user thinks "nothing for me")
- ❌ Returning 500 because a peripheral failed (degrade peripherals, fail critical path only)
- ❌ Same fallback for transient (retry-soon) vs persistent (use stale forever) failures
- ❌ Caching fallback values indefinitely (stale data shown for days)
- ❌ Hardcoded fallback that drifts from real data (e.g. a hardcoded "trending" list from 2 years ago)

## Gate criteria

- Every user-facing endpoint identifies its critical path vs. peripherals
- Peripheral failures use `Promise.allSettled` (or equivalent), not `Promise.all`
- Each peripheral has a documented fallback strategy and a TTL on cached fallback values
- Degraded responses include a `degraded` flag or equivalent signal
- A metric exists for `degraded_response_rate` per endpoint
- The fallback path itself is tested (kill the dependency in a test, verify the response is still useful)
