# caching-layers — CDN + Redis + Query Cache Pattern

## Pattern Summary

Three cache layers, each with a distinct scope. Never use a lower layer when a higher one suffices.

```
Request
  → CloudFront (CDN) — static assets + public API responses (TTL: 60s–24h)
  → ElastiCache Redis  — session data, hot branch config (TTL: 30s–5m)
  → RDS query cache    — none (RDS does not cache; rely on connection pooling + indexes)
```

**Layer 1 — CloudFront (CDN):**
```typescript
// Cache public menu for 60 seconds — set in API Gateway response headers
return {
  statusCode: 200,
  headers: {
    "Cache-Control": "public, max-age=60, stale-while-revalidate=30",
  },
  body: JSON.stringify({ data: menu }),
};

// Never cache authenticated responses
headers: { "Cache-Control": "private, no-store" }
```

**Layer 2 — ElastiCache Redis:**
```typescript
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });

export async function getCachedBranchConfig(branchId: string): Promise<BranchConfig | null> {
  const raw = await redis.get(`branch:config:${branchId}`);
  if (!raw) return null;
  return JSON.parse(raw) as BranchConfig;
}

export async function setCachedBranchConfig(branchId: string, config: BranchConfig): Promise<void> {
  await redis.setEx(`branch:config:${branchId}`, 300, JSON.stringify(config)); // 5 min TTL
}
```

## Full Reference

### Cache key namespacing
```
{resource}:{qualifier}:{id}
branch:config:{branchId}       → BranchConfig object
branch:menu:{branchId}         → MenuItems[]
session:jwt:{userId}           → decoded claims (short TTL)
rate:order:{branchId}          → order rate counter (sliding window)
```

### Invalidation strategy
- Branch config change → `DEL branch:config:{branchId}` on write
- Menu update → `DEL branch:menu:{branchId}` on write
- Never use `FLUSHALL` — use targeted `DEL` or `SCAN` + delete by pattern

### TTL guidelines
| Data | TTL |
|------|-----|
| Branch config | 5 minutes |
| Public menu | 60 seconds |
| JWT claims (server-side) | JWT expiry - 60s |
| Rate limit window | 60 seconds |

### Forbidden
- Caching customer order data in Redis — use RDS with proper indexes
- TTL > 1 hour for any mutable business data — stale data causes incorrect orders
- `KEYS *` in production — blocks Redis, use `SCAN` instead
- No TTL on a key — every Redis key must have `setEx`, not `set`
