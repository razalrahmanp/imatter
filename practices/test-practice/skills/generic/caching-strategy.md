---
id: caching-strategy
title: "Caching strategy — CDN, in-process, distributed cache layers"
layer: generic
tags: [caching, performance, cdn, redis, ttl, invalidation]
applies_to:
  task_types: [add-endpoint, add-worker, optimize-endpoint, add-cache]
  stages: [9]
size_tokens: 210
related: [api-endpoint-design, graceful-degradation, slo-definition]
---

# caching-strategy — Caching Layers Pattern

## Pattern Summary

Three cache tiers. Use the highest layer that works for the data's mutability. Never cache what you can't safely invalidate.

```
Request
  → CDN / Edge         — public, immutable-ish content (TTL: 60s–24h)
  → Distributed cache  — session data, hot config, computed aggregates (TTL: 30s–5m)
  → DB with indexes    — source of truth; no query result cache needed with proper indexes
```

**Layer selection:**
| Data | Layer | TTL |
|------|-------|-----|
| Public static assets | CDN | Immutable + fingerprint |
| Public API responses (menu, catalog) | CDN | 60s |
| Per-tenant config | Distributed cache | 5 min |
| Session / JWT claims | Distributed cache | Token expiry − 60s |
| User-specific data | None — always DB | — |
| Write-heavy data | None — skip cache | — |

**Cache key namespacing (always namespace — never bare string keys):**
```
{resource}:{qualifier}:{id}

config:branch:{branchId}        → BranchConfig object
catalog:menu:{branchId}         → MenuItems[]
rate:order:{branchId}           → sliding window counter
```

**Invalidation on write (always targeted, never FLUSHALL):**
```typescript
// After writing branch config → delete the cache entry
await cache.del(`config:branch:${branchId}`);
// Do NOT: await cache.flushAll()  — blocks cache, clears everyone's data
```

## Full Reference

### TTL rules
- Every key must have an expiry — no TTL-less keys (they become memory leaks)
- Set TTL at key creation, not as a separate call (atomic with `setEx` / `SET ... EX`)
- TTL > 1 hour on mutable business data: requires explicit approval

### Cache-aside pattern (most common)
```
1. Read from cache
2. On miss: read from DB, write to cache, return
3. On write: update DB, invalidate cache
```

### Forbidden
- Caching user-specific data in a shared key (no tenant isolation)
- Caching without TTL
- `KEYS *` in production (blocks Redis) — use `SCAN` instead
