---
id: visual-regression-pattern
title: "Visual regression — Playwright snapshot testing for UI components"
layer: practice
tags: [testing, visual-regression, playwright, snapshot, ci]
applies_to:
  task_types: [add-component, modify-component, add-page, testing]
  stages: [4, 7]
size_tokens: 210
related: [design-drift-audit, accessibility-wcag]
---

# visual-regression-pattern — Visual Regression Testing

## Pattern Summary

Critical UI components have snapshot tests that fail CI when their visual output changes unexpectedly. Visual regressions are caught before they reach production.

## When to add a snapshot test

Add a visual snapshot for:
- Components in the `components_to_reuse` list in `design-spec.jsonc`
- Any component where visual correctness is a user-facing concern (amounts display, status badges, error states)
- Landing pages and auth screens (high-visibility surface)

Do NOT add snapshots for:
- Rapidly iterating components (causes constant approval churn)
- Components with dynamic data that isn't mocked (flaky by nature)

## Playwright snapshot test pattern

```typescript
// src/frontend/components/__visual__/MetricCard.visual.ts
import { test, expect } from "@playwright/test";

test.describe("MetricCard — visual snapshots", () => {
  test("default state — positive value", async ({ page }) => {
    await page.goto("/storybook/metric-card--positive");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("metric-card-positive.png", {
      maxDiffPixelRatio: 0.02,   // 2% pixel tolerance
      threshold: 0.1,             // per-pixel colour tolerance
    });
  });

  test("negative value — error colour", async ({ page }) => {
    await page.goto("/storybook/metric-card--negative");
    await expect(page).toHaveScreenshot("metric-card-negative.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});
```

## Updating snapshots intentionally

When a design change is intentional (new token, new layout):

```bash
# 1. Confirm the change is in the Decision Log
# 2. Update the snapshot baseline
npx playwright test --update-snapshots --grep "MetricCard"

# 3. Review the diff in Playwright's HTML report before committing
npx playwright show-report
```

Never run `--update-snapshots` without reviewing the diff. A snapshot update without a visual review is an untested change.

## CI integration

```yaml
# .github/workflows/ci.yml — add after unit tests
- name: Visual regression tests
  run: npx playwright test --project=visual
  # Fails build on any pixel diff beyond threshold
```

Store snapshots in `src/frontend/components/__visual__/__screenshots__/` and commit them. They are the baseline. Never gitignore snapshot files.

## Forbidden

- Running `--update-snapshots` in CI (CI must read the committed baseline, not regenerate it)
- Committing snapshots without reviewing the visual diff
- Setting `maxDiffPixelRatio` above 0.05 (5%) — at that point the test catches nothing meaningful
