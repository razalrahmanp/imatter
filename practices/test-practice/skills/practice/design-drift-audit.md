---
id: design-drift-audit
title: "Design drift audit — detect production vs Figma divergence"
layer: practice
tags: [design, figma, drift, audit, qa, stage-7]
applies_to:
  task_types: [audit, design-review, observability]
  stages: [7]
size_tokens: 190
related: [visual-regression-pattern, sdlc-figma]
---

# design-drift-audit — Design Drift Detection Pattern

## Pattern Summary

Production UI drifts from design over time — a colour token gets hardcoded, a spacing value shifts, a component gets rebuilt instead of reused. This skill runs a periodic audit to surface that drift before it compounds.

**When to run:**
- Stage 7 audit (Observability)
- After any large UI sprint
- Before a major release

## Audit with Figma MCP (preferred)

```
1. Identify components to check — use `components_to_reuse` from design-spec.jsonc
2. For each component:
   a. Call Figma MCP: push current production rendering to Figma
   b. Compare pushed layer against source design frame
   c. Record any visual property that differs
3. Report findings as open items in SDLC_VALIDATION.md Section 16
4. Do not silently correct — surface every drift and ask
```

**Drift categories:**
| Category | Example | Severity |
|---|---|---|
| Token mismatch | `#1a1f2e` instead of `navy-900 (#0f172a)` | High |
| Spacing deviation | Padding 12px instead of 16px (2× base) | Medium |
| Typography change | DM Sans 400 replaced with Inter 400 | High |
| Component recreation | Custom `<Button>` instead of `<AtlasButton>` | High |
| Missing state | Focus ring absent | High (a11y) |

## Audit without Figma (visual regression fallback)

When Figma MCP is not available, use Playwright snapshots:

```
1. Run visual-regression-pattern skill to capture baseline snapshots
2. Compare current rendering against baseline
3. Highlight pixel diffs
4. For any diff > threshold (5% by default): flag as drift
```

See `visual-regression-pattern` skill for the full snapshot workflow.

## Stage 7 gate evidence

| Item | Evidence |
|---|---|
| Audit was run | Session log entry with date and scope |
| Drift items found | Open items list in SDLC_VALIDATION.md Section 16 |
| Zero high-severity drift | All token and typography mismatches resolved or Decision Log entry for intentional deviation |

## Forbidden

- Running the audit and silently correcting drift without logging open items
- Skipping the audit before major releases
- Treating a token mismatch as "close enough"
