---
id: rabos-brand-system
title: "RABOS brand system — navy/gold, DM Sans/Mono/Fraunces, dark mode"
layer: project
project: rabos
tags: [rabos, design, brand, tailwind, typography, dark-mode, ui]
applies_to:
  task_types: [add-component, modify-component, add-page, add-ui]
  stages: [3, 5]
size_tokens: 220
related: [react-component]
---

# rabos-brand-system — RABOS Visual Design System

## Pattern Summary

All UI uses the RABOS design system tokens exclusively. No ad-hoc colours or fonts.

**Colour tokens (Tailwind custom scale — defined in `tailwind.config.ts`):**
```
Navy (primary backgrounds + surfaces):
  navy-950  #0a0f1a  — page background (dark mode default)
  navy-900  #0f172a  — card background
  navy-800  #1e293b  — elevated surface
  navy-700  #273346  — border / divider
  navy-300  #94a3b8  — muted label text
  navy-100  #e2e8f0  — light mode surface

Gold (accent — CTA, badges, highlights):
  gold-500  #d97706  — primary accent
  gold-400  #f59e0b  — hover accent
  gold-300  #fbbf24  — active / focus ring

Semantic:
  success   #22c55e  — green-500
  warning   #f59e0b  — gold-400
  error     #ef4444  — red-500
```

**Typography (loaded in `layout.tsx` via `next/font/google`):**
```
font-sans   → DM Sans       — body, UI labels, buttons
font-mono   → DM Mono       — code, IDs, amounts, table numbers
font-serif  → Fraunces      — display headings, marketing copy only
```

**Dark mode:** `class` strategy (`darkMode: "class"` in tailwind config). Default is dark. Never use `media` strategy — RABOS UI is always dark unless the user explicitly toggles.

**Usage:**
```tsx
<div className="bg-navy-900 text-white">
  <h1 className="font-serif text-2xl text-gold-400">Dashboard</h1>
  <p className="font-sans text-navy-300">Branch overview</p>
  <span className="font-mono text-sm text-white">₹1,24,500</span>
</div>
```

## Full Reference

### What Fraunces is for
Display headings on marketing pages, section titles in PDF reports, landing page hero text. Not for UI labels, buttons, or table content.

### Amounts and numbers
Always `font-mono`. Tabular numbers ensure decimal alignment in tables. Currency symbol (`₹`) on left, no space before number.

### Forbidden
- Arbitrary colour values (`#ff0000`, `rgb(...)`, inline `style` with colours)
- Using `font-serif` for UI elements (navigation, buttons, form labels)
- `lightMode` classes without a dark-mode counterpart
- Adding new font faces without updating `layout.tsx` and this skill
