---
id: web-vitals
title: "Core Web Vitals — LCP, INP, CLS targets and measurement"
layer: generic
tags: [performance, web-vitals, lcp, inp, cls, lighthouse, ux]
applies_to:
  task_types: [add-page, add-component, performance-audit]
  stages: [9]
size_tokens: 220
related: [bundle-budget, motion-preference, react-design-tokens]
---

# web-vitals — Core Web Vitals Pattern

## Pattern Summary

Every page must hit Core Web Vitals "Good" thresholds at p75 before shipping. Good = Google ranking signal + direct user experience measure.

| Metric | What it measures | Good | Needs improvement | Poor |
|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | Load speed — time to biggest visible element | ≤ 2.5s | 2.5–4s | > 4s |
| **INP** (Interaction to Next Paint) | Responsiveness — time from interaction to visual update | ≤ 200ms | 200–500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | Visual stability — unexpected layout movement | ≤ 0.1 | 0.1–0.25 | > 0.25 |

## Quick wins per metric

### LCP
- Preload the hero image: `<link rel="preload" as="image" href="...">`
- Server-side render or statically generate above-the-fold content
- Use Next.js `<Image>` with `priority` on the largest above-fold image
- No render-blocking fonts: use `next/font` or `font-display: swap`

### INP
- Keep event handlers under 50ms total work — offload to `scheduler.postTask` or `requestIdleCallback`
- Never run DB/API calls synchronously inside a click handler
- Use `useTransition` / `startTransition` for non-urgent state updates in React
- Avoid layout thrash: batch DOM reads before writes

### CLS
- Always specify `width` + `height` on `<img>` and `<video>` elements
- Reserve space for dynamic content (skeleton loaders, not spinner-and-pop)
- Avoid inserting content above existing content (ads, banners, cookie notices)
- Font loading: `size-adjust` or fallback font metrics match to prevent FOUT shift

## Measurement

```bash
# In CI — Lighthouse via Playwright
npx lighthouse http://localhost:3000 --output=json --only-categories=performance

# Field data — web-vitals library
import { onLCP, onINP, onCLS } from "web-vitals";
onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

## Stage 9 gate evidence

- Lighthouse report confirming LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at p75
- Measured on staging against a realistic dataset (not empty-state)
- Report committed to `load-test-results/web-vitals-<date>.json`
