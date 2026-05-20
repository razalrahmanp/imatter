---
name: sdlc-web-vitals
description: Use when measuring or optimizing the user-experienced performance of a web app — covers Core Web Vitals (LCP, INP, CLS), thresholds, and what to fix to hit them.
---

## Rule

Core Web Vitals are Google's user-experience performance metrics. Hitting "good" thresholds for all three is the baseline for a modern web app. Measure them with real user monitoring (RUM), not just lab tests.

## The three vitals

| Metric | What | Good | Needs improvement | Poor |
|---|---|---|---|---|
| **LCP** — Largest Contentful Paint | When the largest content element renders | ≤ 2.5s | 2.5–4.0s | > 4.0s |
| **INP** — Interaction to Next Paint | How quickly the page responds to interaction | ≤ 200ms | 200–500ms | > 500ms |
| **CLS** — Cumulative Layout Shift | How much the page layout shifts during load | ≤ 0.1 | 0.1–0.25 | > 0.25 |

These replaced FID (replaced by INP in 2024) and are measured at p75 of users (75% of users see this or better).

## LCP — what hurts it

| Cause | Fix |
|---|---|
| Large hero image | Compress, use WebP/AVIF, responsive `srcset`, lazy-load below-fold |
| Web fonts | Use `font-display: optional` or `font-display: swap` with system fallback; preconnect |
| Slow server response (TTFB) | Cache, CDN, edge compute, smaller HTML |
| Render-blocking resources | Critical CSS inline; async/defer JS |
| Client-side rendering blocking content | SSR / SSG / RSC where possible |

LCP < 2.5s = roughly: TTFB < 0.5s, network < 1s, render < 1s.

## INP — what hurts it

| Cause | Fix |
|---|---|
| Heavy JS on interaction (re-render, computation) | Move work off main thread (workers); break up long tasks |
| Synchronous network call on click | Make it async; show immediate feedback |
| Massive React re-renders | Memoize, virtualize lists, defer non-critical updates |
| Third-party scripts blocking main thread | Audit; remove or defer |
| Inputs feeding into expensive computation | Debounce; use `useDeferredValue` (React) |

INP is the new INP (replaced FID, May 2024). Measures *all* interactions, not just first.

## CLS — what hurts it

| Cause | Fix |
|---|---|
| Images without dimensions | Always set `width`/`height`; aspect-ratio CSS |
| Web fonts swapping | `font-display: optional` minimizes shift; or match metrics |
| Ads / embeds without reserved space | Reserve placeholder space |
| Late-loading content pushing content down | Skeleton loaders that match final size |
| Animations triggering layout (e.g. animating height) | Animate transform / opacity instead |

CLS < 0.1 = essentially no shifting after initial render.

## Measurement

### Lab — pre-deploy

- Lighthouse (Chrome DevTools)
- WebPageTest
- PageSpeed Insights

Lab tools give you a single number from controlled conditions. Useful for catching regressions in CI.

### Field (RUM) — real users

- `web-vitals` library + your analytics
- Google Search Console "Page Experience" report
- Vercel Analytics, Datadog RUM, Sentry Performance

```ts
import { onCLS, onINP, onLCP } from "web-vitals";

onCLS((m) => sendToAnalytics({ name: "CLS", value: m.value, id: m.id }));
onINP((m) => sendToAnalytics({ name: "INP", value: m.value, id: m.id }));
onLCP((m) => sendToAnalytics({ name: "LCP", value: m.value, id: m.id }));
```

Field metrics are the truth. Lab tools are a proxy. Optimize for the field.

## Budget per page

Set budgets per page type:

| Page | LCP budget | INP budget | CLS budget |
|---|---|---|---|
| Marketing landing | 2.0s | 200ms | 0.05 |
| Logged-in dashboard | 2.5s | 200ms | 0.1 |
| Heavy-compute page (e.g. design canvas) | 3.0s | 300ms | 0.1 |

If a page consistently misses → SEV-3-grade issue. If a page recently regressed → block the deploy / revert.

## Anti-patterns

- ❌ Optimizing lab Lighthouse only; ignoring RUM
- ❌ Ignoring INP because "we hit FID before" (different metric, often worse)
- ❌ Big images without `width`/`height`
- ❌ Animating `top` / `left` / `height` (causes layout)
- ❌ Lazy-loading the hero LCP image (defeats LCP)
- ❌ One huge JS bundle for everything
- ❌ Synchronous third-party scripts at the top of `<head>`
- ❌ No web-vitals tracking in production

## Cross-references

- [[sdlc-bundle-budget]] — bundle-size constraints
- [[sdlc-react-component]] — react-specific perf
- [[sdlc-react-data-fetching]] — data-fetching impact on rendering

## Gate criteria

- Web-vitals tracking in production (RUM); per-page dashboards
- p75 LCP, INP, CLS all in "good" range
- Performance budgets per page type
- Lighthouse CI on PRs blocking obvious regressions
- An on-call notification when p75 vitals drop into "poor"
- Lazy-loading, async loading, image optimization defaults applied
