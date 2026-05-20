---
id: design-spec-jsonc
title: "Design spec — JSONC format for version-controlled UI intent"
layer: generic
tags: [ui, design, spec, jsonc, tokens, figma-alternative]
applies_to:
  task_types: [add-component, add-page, add-ui, design-system]
  stages: [1, 2, 3]
size_tokens: 310
related: [design-system-tokens, react-design-tokens, accessibility-wcag]
---

# design-spec-jsonc — JSONC Design Specification Pattern

## Pattern Summary

Every UI feature starts with a `design-spec.jsonc` — a version-controlled, machine-readable design source that carries aesthetic intent and is readable by both Claude and humans. It bridges "vague brief" and "pixel-perfect Figma" without requiring a design tool.

**Required at Stage 1** for any project with a frontend layer. A missing design spec is a missing required artifact.

```jsonc
{
  // Who this is for and what they need
  "purpose": "Atlas dashboard — branch managers reviewing daily P&L",
  "audience": "power users, desktop-first, data-dense OK",
  "aesthetic": "data-dense editorial — confident, precise, no decoration",

  "typography": {
    "display": "Fraunces, serif, 600",        // section headers, hero numbers
    "body":    "DM Sans, 400",                // labels, descriptions, nav
    "numeric": "DM Mono, 500"                 // amounts, IDs, table values
  },

  "palette": {
    "bg":      "#0A0E1A",   // page background
    "surface": "#11172A",   // card / panel
    "primary": "#D4AF37",   // gold accent — CTA, highlights
    "text":    "#E8E8E8",
    "muted":   "#8A8FA0",
    "success": "#22C55E",
    "error":   "#EF4444"
  },

  "layout": {
    "structure": "3-zone: header / split-map-drilldown / insight-feed",
    "spacing":   "8px base, 1.5× rhythm",
    "breakpoints": "mobile-first; tablet 768px; desktop 1280px"
  },

  "motion": {
    "intent":   "subtle, purposeful — never decorative",
    "easing":   "cubic-bezier(0.16, 1, 0.3, 1)",
    "duration": "200ms micro-interactions, 350ms panel transitions",
    "respects_reduced_motion": true            // mandatory
  },

  "components_to_reuse": [
    "AtlasMap", "AtlasDrilldown", "MetricCard"
  ],

  "forbidden": [
    "Inter or system-ui as primary font",
    "Purple gradients",
    "Generic card shadows on every surface",
    "Light background without dark toggle"
  ]
}
```

## Rules

- **One spec per feature, not per component.** A spec covers a screen or flow.
- **Commit alongside code.** The spec file belongs in version control — it is the design record.
- **Writer agent reads spec before generating code.** No UI code without a spec read first.
- **Forbidden list is enforced.** Any pattern in `forbidden` triggers a lint failure from the verifier.
- **`components_to_reuse` maps to codebase components.** Writer agent imports them; does not recreate them.

## When Figma exists

If a Figma frame is available, the JSONC spec is still written — it carries the *intent* that Figma doesn't surface (audience, aesthetic rationale, forbidden patterns). The spec + Figma together are better than either alone.

## Forbidden

- Generating UI without reading the spec first
- Adding spec fields inline in component code (spec lives in its own file)
- Drifting from `palette` values — use the exact hex values as design tokens
