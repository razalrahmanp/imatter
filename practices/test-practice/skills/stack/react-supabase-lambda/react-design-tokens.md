---
id: react-design-tokens
title: "React design tokens — CSS variables + Tailwind config + TypeScript types"
layer: stack
stack: react-supabase-lambda
tags: [react, design-tokens, tailwind, css-variables, typescript, theming]
applies_to:
  task_types: [add-component, design-system, add-page]
  stages: [2, 3]
size_tokens: 250
related: [design-system-tokens, react-component, rabos-brand-system]
context7_library_id: /tailwindlabs/tailwindcss
---

# react-design-tokens — React Design Token Pattern

## Pattern Summary

Design tokens live in three layers: CSS variables (source of truth), Tailwind config (utility class surface), TypeScript constants (type-safe access). All three stay in sync. Components use Tailwind classes — never raw CSS variable names.

## Layer 1 — CSS variables (`src/frontend/styles/tokens.css`)

```css
:root {
  /* Colour primitives */
  --primitive-navy-950: #0a0f1a;
  --primitive-navy-900: #0f172a;
  --primitive-navy-800: #1e293b;
  --primitive-navy-700: #273346;
  --primitive-navy-300: #94a3b8;
  --primitive-gold-500: #d97706;
  --primitive-gold-400: #f59e0b;
  --primitive-gold-300: #fbbf24;

  /* Semantic colour tokens */
  --color-bg:           var(--primitive-navy-950);
  --color-surface:      var(--primitive-navy-900);
  --color-elevated:     var(--primitive-navy-800);
  --color-border:       var(--primitive-navy-700);
  --color-text:         #e8e8e8;
  --color-muted:        var(--primitive-navy-300);
  --color-accent:       var(--primitive-gold-500);
  --color-accent-hover: var(--primitive-gold-400);

  /* Spacing */
  --spacing-1: 8px;
  --spacing-2: 16px;
  --spacing-3: 24px;
  --spacing-4: 32px;

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

/* Light mode override — only if dark toggle is implemented */
.light {
  --color-bg:      #f8fafc;
  --color-surface: #ffffff;
  --color-text:    #0f172a;
  --color-muted:   #64748b;
}
```

## Layer 2 — Tailwind config (`tailwind.config.ts`)

```typescript
import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:           "var(--color-bg)",
        surface:      "var(--color-surface)",
        elevated:     "var(--color-elevated)",
        border:       "var(--color-border)",
        text:         "var(--color-text)",
        muted:        "var(--color-muted)",
        accent:       "var(--color-accent)",
        "accent-h":   "var(--color-accent-hover)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
    },
  },
} satisfies Config;
```

## Layer 3 — TypeScript token types (`src/frontend/styles/tokens.ts`)

```typescript
// Type-safe access for non-Tailwind contexts (canvas, SVG, print)
export const tokens = {
  color: {
    bg:      "var(--color-bg)",
    surface: "var(--color-surface)",
    accent:  "var(--color-accent)",
    muted:   "var(--color-muted)",
  },
  radius: {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
  },
} as const;

export type ColorToken = keyof typeof tokens.color;
```

## Forbidden

- Raw hex values in component className (`bg-[#0f172a]` → use `bg-surface`)
- Importing `tokens.ts` in components that could use Tailwind (Tailwind is zero-runtime)
- Adding new tokens to Tailwind config without adding them to `tokens.css` first
- Overriding tokens with `style={{ color: ... }}` inline
