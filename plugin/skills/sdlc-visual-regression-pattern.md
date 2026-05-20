---
name: sdlc-visual-regression-pattern
description: Use when adding visual regression tests to a frontend — covers when they help vs hurt, the Storybook + Chromatic / Percy / Playwright pattern, and the false-positive management.
---

## Rule

Visual regression catches unintended UI changes by comparing screenshots across versions. It's powerful but easy to misuse — managed badly, it turns into a flake factory. Used well, it prevents subtle drift and catches regressions logical tests miss.

## When it helps

| Good fit | Why |
|---|---|
| Design system components | Tightly defined; appearance matters |
| Cross-browser rendering checks | Same component on Chrome / Safari / Firefox |
| Email templates | Hard to test logically; appearance is the contract |
| Marketing pages | Appearance is the product |
| Per-locale screenshots | Catch RTL / long-translation issues |

## When it hurts

| Bad fit | Why |
|---|---|
| Pages with real user data | Data changes → false positive every run |
| Animations / video | Frame timing varies |
| Pages with timestamps | Always "2 minutes ago" different |
| Dynamic ads / 3rd-party widgets | Different content each load |
| Pages with random elements | Layout shifts |
| End-to-end happy paths | Logical tests are better |

## Pattern — Storybook + Chromatic

```tsx
// Button.stories.tsx
export default { component: Button };

export const Primary = { args: { variant: "primary", children: "Click" } };
export const PrimaryHover = { args: { variant: "primary", children: "Click" }, parameters: { pseudo: { hover: true } } };
export const PrimaryDisabled = { args: { variant: "primary", disabled: true, children: "Click" } };
export const LoadingState = { args: { variant: "primary", loading: true, children: "Click" } };
```

Chromatic snapshots every story on every PR. Visual diff → reviewer approves or rejects.

## Pattern — Playwright with screenshots

```ts
test("dashboard header renders correctly", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".header")).toHaveScreenshot("dashboard-header.png");
});
```

Stores baseline images in repo. Diffs on subsequent runs.

## False-positive management

The #1 reason visual regression dies in teams: flake fatigue.

Sources of false positives:

| Source | Mitigation |
|---|---|
| Anti-aliasing / sub-pixel rendering | Use the same OS in CI as for baseline; small tolerance (0.1%) |
| Animation in flight | Disable animations in test mode |
| Timestamps | Mock the clock |
| Network jitter | Wait for networkIdle; mock APIs |
| Random data | Seed RNG; use fixtures |
| Lazy-loaded images | Wait for images to load; or use placeholders |
| Cursor / scroll position | Reset before screenshot |
| Browser version changes | Pin browser version; review baselines on browser updates |

For a stable suite: heavily controlled environment + tolerance window + low fix-it cost.

## Baseline management

When a change is intentional:

- PR shows visual diff
- Reviewer accepts → new baseline becomes the latest
- Old baselines archived (for rollback or comparison)

If reviewer can't tell whether the diff is intentional → they should ask the designer. Visual regression diffs are art-direction reviews.

## Storybook vs page-level

| Storybook (component-level) | Page-level (full page) |
|---|---|
| Fast, isolated, deterministic | Slower, fragile, real-world |
| Many small snapshots | Few large snapshots |
| Reviewer sees the component clearly | Reviewer sees the page context |
| Better for design system | Better for marketing pages, emails |

Most teams: Storybook for components + 5–10 critical page-level smoke screenshots.

## CI integration

```yaml
# .github/workflows/visual-regression.yml
- name: Storybook + Chromatic
  uses: chromaui/action@v1
  with:
    projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
    onlyChanged: true   # only compare stories that changed
    autoAcceptChanges: false  # require human approval
```

`onlyChanged` is essential — comparing every story on every PR is slow.

## Cost considerations

Chromatic / Percy charge per snapshot. A growing design system can rack up costs:

- Limit to components, not all combinations of all stories
- Use `onlyChanged` to skip unchanged stories
- Run per-PR, not on every commit in a draft
- Don't snapshot trivial variants

## Anti-patterns

- ❌ Snapshotting full pages with dynamic content (flake city)
- ❌ Auto-accepting changes (defeats the purpose)
- ❌ Tolerance set so high that real changes are missed
- ❌ Tolerance set so low that every PR has false positives
- ❌ Visual regression as the only test (catches appearance, not behavior)
- ❌ Snapshotting before networkidle / image load (race conditions)
- ❌ Storybook tests that depend on global setup (works locally, breaks in CI)
- ❌ Leaving baseline updates as a chore that piles up

## Cross-references

- [[sdlc-design-drift-audit]] — visual regression is one mechanism in drift detection
- [[sdlc-e2e-test-pattern]] — different testing layer
- [[sdlc-design-system-tokens]] — what's being protected
- [[sdlc-unit-test-pattern]] — different scope

## Gate criteria

- Visual regression configured for at least design-system components
- Snapshots stored deterministically (pinned browser, OS, viewport)
- Animations disabled in test mode
- Clock and randomness mocked for deterministic snapshots
- Reviewer approval required before baseline updates
- False-positive rate < 5% (track it)
- Snapshot cost monitored (per-snapshot tool charges)
