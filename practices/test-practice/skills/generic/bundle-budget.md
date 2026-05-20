---
id: bundle-budget
title: "Bundle budget — JS size limits per route enforced in CI"
layer: generic
tags: [performance, bundle, webpack, next-js, tree-shaking, ci]
applies_to:
  task_types: [add-component, add-page, add-dependency]
  stages: [5, 9]
size_tokens: 210
related: [web-vitals, react-design-tokens]
---

# bundle-budget — JavaScript Bundle Budget Pattern

## Pattern Summary

Every route has a JS bundle budget. Exceeding it blocks the CI build. Bundle size is a performance property designed in at architecture time — not tuned after launch.

**Default budgets (adjust per project in `next.config.ts`):**

| Route type | Initial JS limit | Per-page limit |
|---|---|---|
| Public / marketing | 80 kB gzipped | 120 kB |
| Auth / onboarding | 60 kB | 90 kB |
| App dashboard (authenticated) | 120 kB | 180 kB |
| Admin / internal tools | 150 kB | 220 kB |

These are hard limits. A feature that needs a 400 kB library requires a Decision Log entry before import.

## Enforcing in CI (Next.js)

```js
// next.config.ts
const nextConfig = {
  experimental: {
    bundleAnalyzer: {
      enabled: process.env.ANALYZE === "true",
    },
  },
  // Fail build if bundle exceeds budget
  onDemandEntries: { maxInactiveAge: 0 },
};

// package.json scripts
"analyze": "ANALYZE=true next build",
"size-check": "bundlesize"
```

```json
// bundlesize.config.json
{
  "files": [
    { "path": ".next/static/chunks/pages/*.js", "maxSize": "180 kB" },
    { "path": ".next/static/chunks/framework*.js", "maxSize": "120 kB" }
  ]
}
```

## Reducing bundle size

**Before importing any library, check its size at bundlephobia.com.** Prefer alternatives under 5 kB when a full library (e.g. lodash, moment) has a focused alternative (e.g. date-fns, just-format-number).

```typescript
// ❌ Imports all of lodash (531 kB)
import _ from "lodash";

// ✅ Tree-shaken: only the function used (< 1 kB)
import debounce from "lodash/debounce";

// ✅ Even better: use the native alternative
const debounce = (fn: Function, ms: number) => { /* ... */ };
```

**Dynamic import for heavy, route-specific code:**
```typescript
const HeavyChart = dynamic(() => import("../components/HeavyChart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
```

## Forbidden

- Adding a dependency > 50 kB without a Decision Log entry
- Importing barrel files (`import { x } from "library"`) without verifying tree-shaking works
- Committing with `ANALYZE=true` — analyzer mode is local only
