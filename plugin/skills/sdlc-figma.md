---
name: sdlc-figma
description: Use when a Figma URL is provided for a UI task, or when running a design-drift audit — reads Figma frame data before generating code, and optionally pushes production UI back for drift detection.
---

# sdlc-figma

## Prerequisites

Figma MCP must be configured:
```bash
claude mcp add figma --transport http https://mcp.figma.com/mcp
```

If not available: fall back to `design-spec.jsonc` or `/frontend-design`. Tell the user Figma MCP is not installed and name the fallback being used.

Code Connect (for component mapping) requires Figma Organization or Enterprise plan. If unavailable, component generation will be from scratch rather than reusing existing codebase components.

## Design-to-code (generating from Figma)

When a Figma URL is part of the task:

1. **Call `get_design_context`** with the frame URL.
   - Read: layer names, component IDs, colors (confirm they match design tokens), spacing values, typography styles, Auto Layout settings.
   - Do NOT infer from a screenshot — read the structured data.

2. **Check Code Connect** — if the frame references a component that has a Code Connect mapping, use the mapped code component. Do not recreate it from scratch.

3. **Generate code** that faithfully matches the Figma design:
   - Use exact token values from the design (map to codebase tokens, not arbitrary values)
   - Preserve Auto Layout → Flexbox/Grid mapping
   - Preserve component hierarchy — Figma groups map to React component composition

4. **Run four-pass verification** (see `sdlc-frontend-design`).

## Code-to-Figma (drift detection)

Run at Stage 7 audit or any time you suspect production UI has diverged from design:

1. **Identify the production component(s)** to check.
2. **Push current production UI** to Figma using Figma MCP's push capability.
3. **Compare the pushed layer** against the source design frame.
4. **Report drift** — any visual property that differs from the source:
   - Colour token mismatch
   - Spacing deviation
   - Typography change
   - Missing or added component

5. **Log open items** for each drift found in SDLC_VALIDATION.md Section 16. Do not silently correct — surface and ask.

## Code Connect verification (Stage 4 audit)

During Stage 4 audit, verify that the `components_to_reuse` list in `design-spec.jsonc` has Code Connect mappings in Figma. Check per component:

```
✅ AtlasMap — Code Connect mapping: src/frontend/components/AtlasMap.tsx
✅ MetricCard — Code Connect mapping: src/frontend/components/MetricCard.tsx
⚠️  InsightFeed — No Code Connect mapping found (generates from scratch)
```

Components without Code Connect are higher risk for duplication rot. Log as open item if count > 2.

## Limitations to communicate

- Code Connect requires Organization/Enterprise Figma plan.
- Incremental updates to existing components are harder than new generation — may require manual editing after AI output.
- Figma MCP reads design intent, not interaction logic — animations, state transitions, hover effects require separate skill (`react-motion-library`).
