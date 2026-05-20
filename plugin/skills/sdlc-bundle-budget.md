---
name: sdlc-bundle-budget
description: Use when shipping a frontend — sets JavaScript bundle-size budgets per route, monitors them in CI, and lists the techniques that bring bundles down.
---

## Rule

Set JS bundle size budgets per route. Block deploys when budget is blown without justification. Smaller bundles mean faster TTI / INP and better mobile experience. Budget is not optional — it's how you keep complexity from creeping.

## Recommended budgets (starting points)

| Page type | First-load JS (gzipped) | Lighthouse JS bytes |
|---|---|---|
| Marketing / landing | ≤ 150 KB | ≤ 500 KB |
| Logged-in dashboard | ≤ 250 KB | ≤ 750 KB |
| Heavy app feature | ≤ 350 KB | ≤ 1 MB |
| 3rd-party scripts | ≤ 100 KB | ≤ 300 KB |

Mobile 3G/4G is the real bar. On a desktop fiber connection budget doesn't matter; on a mobile in poor coverage it matters a lot.

## What goes in a "first-load" budget

The JS that must download/parse/execute before the page becomes interactive:

- Framework runtime (React + ReactDOM ≈ 45 KB gzipped)
- Router
- Above-the-fold component code
- Critical state management
- Initial data layer (React Query / SWR)

What's OUTSIDE the first-load budget:
- Below-the-fold features (lazy-loaded)
- Modals not yet open
- Routes not yet visited (code-split)
- Polyfills for very old browsers (load conditionally)

## Pattern — Webpack / Vite bundle analyzer

Run after every build:

```bash
# Vite
pnpm vite build --report

# Webpack
webpack-bundle-analyzer dist/stats.json

# Next.js
ANALYZE=true pnpm build
```

You'll see a treemap of what's in your bundle. Common surprises:

- A single date library taking 40 KB (moment.js)
- A markdown library duplicated by transitive deps
- An unused export pulling in the whole package
- A polyfill for ES5 browsers that no longer matters

## Common bundle-shrinking moves

| Move | Typical savings |
|---|---|
| Replace `moment` with `date-fns` or `dayjs` | 30–50 KB |
| Replace `lodash` with native methods or `lodash-es` + tree-shake | 20–40 KB |
| Switch icon library to per-icon imports | 10–80 KB |
| Code-split routes (React.lazy + Suspense) | Varies, can be huge |
| Lazy-load modals / drawers | 5–30 KB |
| Remove polyfills for unsupported browsers | 10–30 KB |
| Use ES modules + tree-shaking (esbuild / Vite / Webpack 5) | 10–40 KB |
| Self-host fonts instead of font CDN if blocking | Latency win, not bytes |
| Drop unused CSS (PurgeCSS / Tailwind tree-shake) | Varies |

## CI budget enforcement

```yaml
# bundlewatch.config.json
{
  "files": [
    { "path": "dist/index-*.js", "maxSize": "150kB" },
    { "path": "dist/dashboard-*.js", "maxSize": "250kB" }
  ]
}
```

Tools:
- bundlewatch
- size-limit
- webpack-bundle-analyzer + custom CI check

Block the PR if budget exceeded. Allow override with explicit reason in PR description.

## Third-party scripts — the wildcards

Marketing tags, analytics, chat widgets, A/B test SDKs. They sneak in via "just paste this snippet" requests.

| Pattern | Approach |
|---|---|
| Google Analytics / GTM | Async, after first paint |
| Intercom / chat | Lazy-load after user interaction |
| A/B test SDK | Server-side rendering preferred; or async with anti-flicker |
| Pixel trackers | Image pixels, no JS |

Audit third-party impact: each tag visible in bundle / network panel; tracked in a register.

## Cross-references

- [[sdlc-web-vitals]] — bundle size affects LCP, INP
- [[sdlc-react-component]] — splitting components for lazy load
- [[sdlc-design-system-tokens]] — token CSS overhead

## Anti-patterns

- ❌ No budget; bundle grows quietly until users complain
- ❌ Lab-only measurement; never check on mobile / 3G
- ❌ Importing the whole library when one function is needed
- ❌ Importing icon libraries as a single bundle
- ❌ Loading polyfills for browsers you don't support
- ❌ Marketing-driven third-party tags added without engineering review
- ❌ Tree-shaking disabled by accident (e.g. CommonJS deps that break it)
- ❌ Modal contents in the first-load bundle (lazy them)

## Gate criteria

- Bundle budgets per page type documented and enforced in CI
- Bundle analyzer report reviewed quarterly
- Third-party scripts inventoried; net impact known
- Mobile / 3G load time measured (Lighthouse Mobile profile)
- Lazy-load applied to non-critical UI (modals, below-fold)
- Tree-shaking working: `import { x } from "lib"` pulls only what's used
- Polyfills conditional on browser feature detection, not bundled for all
