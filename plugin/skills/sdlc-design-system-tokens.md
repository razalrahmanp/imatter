---
name: sdlc-design-system-tokens
description: Use when starting a design system, refactoring inconsistent UI styling, or auditing for drift — covers the token taxonomy (primitive → semantic → component) and how to keep tokens authoritative.
---

## Rule

Visual design is encoded in tokens, not in component code. Tokens are the single source of truth for color, spacing, typography, radius, shadow, and motion. Three layers: primitives (raw values), semantic (meaning), components (consumption). Designers and engineers share the token names.

## The three-layer model

```
Primitive tokens          Semantic tokens                 Component tokens
"What it is"              "What it's used for"            "Where it's applied"
─────────────             ──────────────────              ────────────────
blue-500: #4F46E5  ──→    color.action.primary  ──→       button.primary.bg
blue-700: #3730A3  ──→    color.action.primary.hover ──→  button.primary.bg.hover
gray-100: #F3F4F6  ──→    color.surface.subtle  ──→       card.bg
space-4: 1rem      ──→    space.layout.tight    ──→       card.padding
```

Why three layers:

- **Primitives** rarely change. Adding `blue-600` doesn't break anything.
- **Semantic** changes are theme-level (light → dark mode just remaps semantic to different primitives).
- **Component** tokens isolate one component's choices from the global system.

Skipping the middle layer (component → primitive directly) forces every component update on every primitive change.

## Token categories

### Color

```
Primitive: red-50, red-100, ..., red-900 (10 shades per hue)
Semantic:
  color.action.primary
  color.action.secondary
  color.feedback.success
  color.feedback.warning
  color.feedback.error
  color.feedback.info
  color.text.default
  color.text.muted
  color.text.inverted
  color.surface.default
  color.surface.subtle
  color.surface.raised
  color.border.default
  color.border.strong
```

### Spacing

```
Primitive: space-1 (4px), space-2 (8px), space-3 (12px), ..., space-20 (80px)
Semantic:
  space.layout.tight       — 8px
  space.layout.default     — 16px
  space.layout.loose       — 24px
  space.component.tight    — 4px (button padding)
  space.component.default  — 8px
```

Use a consistent base unit (4px is common). Don't introduce odd-pixel values without reason.

### Typography

```
Primitive: font.family.sans, font.family.mono
           font.size.12, .14, .16, .18, .20, .24, .32, .40, .56, .72
           font.weight.regular (400), medium (500), semibold (600), bold (700)
           font.line-height.tight (1.2), normal (1.5), loose (1.7)

Semantic:
  text.body.default       — 16/24, regular
  text.body.small         — 14/20, regular
  text.heading.h1         — 40/48, bold
  text.heading.h2         — 32/40, bold
  text.heading.h3         — 24/32, semibold
  text.caption            — 12/16, medium
  text.button             — 14/20, semibold
```

### Radius

```
radius.none: 0
radius.sm:   4px
radius.md:   8px
radius.lg:   12px
radius.xl:   16px
radius.full: 9999px
```

### Shadow

```
shadow.sm:  0 1px 2px rgba(0,0,0,0.05)
shadow.md:  0 4px 6px rgba(0,0,0,0.07)
shadow.lg:  0 10px 15px rgba(0,0,0,0.1)
```

### Motion

```
motion.duration.fast:   150ms
motion.duration.medium: 300ms
motion.duration.slow:   500ms
motion.easing.standard: cubic-bezier(0.4, 0, 0.2, 1)
motion.easing.decel:    cubic-bezier(0, 0, 0.2, 1)
```

## Implementation — CSS variables (universal)

```css
:root {
  /* Primitives */
  --color-blue-500: #4F46E5;
  --color-gray-100: #F3F4F6;
  --space-4: 1rem;

  /* Semantic */
  --color-action-primary: var(--color-blue-500);
  --color-surface-subtle: var(--color-gray-100);
  --space-layout-default: var(--space-4);
}

[data-theme="dark"] {
  --color-surface-subtle: #1F2937;   /* same semantic, different primitive in dark mode */
}
```

Components consume semantic tokens:

```css
.button-primary {
  background: var(--color-action-primary);
  padding: var(--space-component-default) var(--space-layout-default);
  border-radius: var(--radius-md);
}
```

## Tooling — pick one chain

| Tool | What it does |
|---|---|
| **Style Dictionary** | Reads JSON tokens, emits CSS, SCSS, JS, iOS, Android |
| **Tokens Studio** (Figma plugin) | Manages tokens in Figma, syncs to Git |
| **Tailwind config** | Tokens become Tailwind utilities |
| **Hand-rolled CSS vars** | Lowest tooling overhead, works everywhere |

For most teams: Style Dictionary + Tokens Studio (designers edit in Figma → tokens auto-sync to Git → CI emits all platforms).

## Authorship — who owns what

| Layer | Owner |
|---|---|
| Primitives | Design system team (rare changes, reviewed) |
| Semantic | Design system team (additions need a use case) |
| Component | Component team (within taste-and-guidelines guardrails) |

When a product team wants a "slightly different blue" — that's a sign the semantic layer is incomplete. Add a new semantic token, don't fork the primitive.

## Anti-patterns

- ❌ Hardcoded hex colors in component code (`background: #4F46E5` instead of `var(--color-action-primary)`)
- ❌ Skipping the semantic layer (components depend on primitives directly — theme switching impossible)
- ❌ Inconsistent units (`margin: 7px` instead of using the spacing scale)
- ❌ Token names that describe appearance (`color-orange`) instead of role (`color-feedback-warning`) — can't theme
- ❌ One big token file that nobody curates — drift creeps in
- ❌ Different token names in Figma vs. code (designer says "primary blue", code calls it "indigo-500")
- ❌ Tokens that don't map to dark mode (no semantic indirection)
- ❌ Custom values inline ("just this one component") that accumulate

## Detection — design drift audits

Periodically grep for non-token values in styles:

```bash
# Hex colors outside the tokens file
grep -rE "#[0-9a-fA-F]{3,6}" --include="*.{css,tsx,vue}" \
  | grep -v "tokens.css" \
  | grep -v "// @allow-hex"
```

A high count means tokens are being bypassed. Add a lint rule (e.g. `stylelint-no-restricted-syntax`) to forbid new hex colors outside the token file.

## Gate criteria

- A token file exists with primitive, semantic, and component layers
- Every color, spacing, typography choice in UI code references a token, not a literal
- Dark mode (if supported) is implemented by remapping semantic tokens, not by duplicating components
- A lint rule prevents new hex / magic-number colors and spacing
- Designers and engineers use the same token names (Figma tokens match code tokens)
- An audit job runs periodically detecting drift; output reviewed
- A design-system documentation page lists every token and its current value
