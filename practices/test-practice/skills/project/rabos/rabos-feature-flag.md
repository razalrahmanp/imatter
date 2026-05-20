---
id: rabos-feature-flag
title: "RABOS feature flag — per-tenant flag pattern, evaluation logic"
layer: project
project: rabos
tags: [rabos, feature-flag, tenant, per-tenant, rollout]
applies_to:
  task_types: [add-feature-flag, modify-feature-flag, add-handler, add-worker]
  stages: [3, 5]
size_tokens: 200
related: [rabos-tenant-context, caching-strategy, supabase-rls]
---

# rabos-feature-flag — Per-Tenant Feature Flag Pattern

## Pattern Summary

Feature flags are per-tenant and evaluated at request time from the branch config cache. Never hardcode flag checks.

```typescript
import { getFlag } from "../../shared/flags";

// In handler — always check flag before running flagged feature
const isAtlasEnabled = await getFlag("atlas_insights", branchId);
if (!isAtlasEnabled) {
  return { statusCode: 200, body: JSON.stringify({ data: null, reason: "feature_disabled" }) };
}
```

**`getFlag` resolution order:**
```
1. Branch-level override (branch_flags table)   — highest priority
2. Tenant-level default (tenant_flags table)
3. Global default (flags table)                 — lowest priority
```

**Flag evaluation is cached per-branch for 5 minutes.** Invalidate on branch config write:
```typescript
// After writing any branch setting
await cache.del(`flags:branch:${branchId}`);
```

**Flag names are constants — never free strings:**
```typescript
// src/shared/flags/constants.ts
export const FLAGS = {
  ATLAS_INSIGHTS:    "atlas_insights",
  RIS_ANALYST:       "ris_analyst",
  BEDROCK_BATCH:     "bedrock_batch_inference",
  EXPORT_PDF:        "export_pdf",
} as const;

// Usage
await getFlag(FLAGS.ATLAS_INSIGHTS, branchId);
```

## Full Reference

### Flag schema
```sql
CREATE TABLE flags (
  name         text PRIMARY KEY,
  enabled      boolean NOT NULL DEFAULT false,
  description  text
);

CREATE TABLE branch_flags (
  branch_id  uuid REFERENCES branches(id),
  name       text,
  enabled    boolean NOT NULL,
  PRIMARY KEY (branch_id, name)
);
```

### Gradual rollout
Enable for specific branches first via `branch_flags`. After validation, set the global default in `flags`.

### Forbidden
- Free-string flag names (`getFlag("my_feature", ...)`) — use constants
- Checking flags inside DB queries or migrations
- TTL > 5 minutes on flag cache (feature kills need to propagate quickly)
