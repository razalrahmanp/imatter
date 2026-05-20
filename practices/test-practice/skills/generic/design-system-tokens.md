---
id: design-system-tokens
title: "Design system tokens — naming, scale, CSS variables, theming"
layer: generic
tags: [design-system, tokens, css-variables, tailwind, theming, dark-mode]
applies_to:
  task_types: [design-system, add-component, add-page]
  stages: [2, 3]
size_tokens: 240
related: [react-design-tokens, design-spec-jsonc, rabos-brand-system]
---

# design-system-tokens — Design Token Pattern

## Pattern Summary

All visual values (colours, spacing, typography, radii, shadows) are tokens — named references, never raw values. A component that uses `#0f172a` instead of `var(--color-surface)` or `bg-navy-900` has bypassed the design system.

## Token taxonomy

```
Primitive tokens  → specific values:  --color-navy-900: #0f172a
Semantic tokens   → roles:            --color-surface: var(--color-navy-900)
Component tokens  → component parts:  --card-bg: var(--color-surface)
```

**Always use semantic or component tokens in component code.** Primitive tokens are defined once in the token file; never referenced directly in components.

## Naming conventions

```
--{category}-{role}-{variant}
                    └── modifier (hover, active, disabled, muted)
              └── semantic role (bg, text, border, accent)
    └── category (color, spacing, radius, shadow, font)

Examples:
  --color-bg-primary       primary page background
  --color-text-muted       secondary / less-prominent text
  --color-border-default   default divider
  --color-accent-default   primary CTA / highlight colour
  --spacing-base           8px base unit
  --radius-card            card corner radius
  --font-body              body font family
  --font-numeric           monospace for numbers/amounts
```

## CSS variable implementation

```css
/* tokens.css — single source of truth */
:root {
  /* Primitives */
  --primitive-navy-900: #0f172a;
  --primitive-navy-800: #1e293b;
  --primitive-gold-500: #d97706;

  /* Semantic — light mode */
  --color-bg-primary:     var(--primitive-navy-900);
  --color-surface:        var(--primitive-navy-800);
  --color-text-default:   #e8e8e8;
  --color-text-muted:     #94a3b8;
  --color-accent-default: var(--primitive-gold-500);
}

.light {
  /* Override semantic tokens for light mode only */
  --color-bg-primary:   #f8fafc;
  --color-surface:      #ffffff;
  --color-text-default: #0f172a;
  --color-text-muted:   #64748b;
}
```

## Tailwind integration

```js
// tailwind.config.ts
theme: {
  extend: {
    colors: {
      // Map Tailwind classes to CSS variables
      "bg-primary": "var(--color-bg-primary)",
      "surface":    "var(--color-surface)",
      "text":       "var(--color-text-default)",
      "muted":      "var(--color-text-muted)",
      "accent":     "var(--color-accent-default)",
    },
  },
},
```

## Forbidden

- Hardcoded hex values in component files (`className="bg-[#0f172a]"`)
- Defining new tokens without adding them to `tokens.css` first
- Using primitive token names in components (use semantic tokens)
- Dark mode with `media` strategy when `class` strategy is required by the project
