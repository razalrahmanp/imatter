---
id: rabos-component-library
title: "RABOS component library — reusable components and Code Connect mappings"
layer: project
project: rabos
tags: [rabos, components, design-system, code-connect, figma, reuse]
applies_to:
  task_types: [add-component, add-page, add-ui]
  stages: [3, 4]
size_tokens: 260
related: [rabos-brand-system, react-component, react-aria-pattern, react-design-tokens]
---

# rabos-component-library — RABOS Reusable Components

## Pattern Summary

Before creating any new UI component, check this list. If the component exists, import it. Do not recreate it. Creating a bespoke alternative to a library component without a Decision Log entry is forbidden.

## Core component inventory

| Component | Path | Purpose | Props |
|---|---|---|---|
| `AtlasMap` | `src/frontend/components/atlas/AtlasMap.tsx` | Geo map with branch pins | `branches`, `onSelect`, `selectedId` |
| `AtlasDrilldown` | `src/frontend/components/atlas/AtlasDrilldown.tsx` | Branch detail panel | `branchId`, `onClose` |
| `MetricCard` | `src/frontend/components/shared/MetricCard.tsx` | KPI tile (amount, trend, label) | `label`, `value`, `currency`, `trend` |
| `InsightFeed` | `src/frontend/components/insights/InsightFeed.tsx` | Live insight stream | `branchId`, `maxItems` |
| `AtlasButton` | `src/frontend/components/shared/AtlasButton.tsx` | Primary/secondary CTA | `variant`, `size`, `disabled`, `onClick` |
| `AtlasTable` | `src/frontend/components/shared/AtlasTable.tsx` | Data table with sort/filter | `columns`, `data`, `onSort` |
| `StatusBadge` | `src/frontend/components/shared/StatusBadge.tsx` | Status pill | `status`: `active` \| `pending` \| `error` |
| `AmountDisplay` | `src/frontend/components/shared/AmountDisplay.tsx` | Currency formatted in DM Mono | `amount`, `currency`, `size` |
| `SkeletonCard` | `src/frontend/components/shared/SkeletonCard.tsx` | Loading placeholder (no spinner) | `lines`, `width` |

## Usage examples

```tsx
// ✅ Import from library — never recreate
import { MetricCard } from "@/components/shared/MetricCard";
import { AtlasButton } from "@/components/shared/AtlasButton";

// ✅ Correct usage
<MetricCard
  label="Today's Revenue"
  value={124500}
  currency="INR"
  trend={+3.2}
/>

<AtlasButton variant="primary" onClick={handleConfirm}>
  Confirm
</AtlasButton>

// ❌ Never do this
<div className="bg-navy-900 p-4 rounded-lg">
  <span className="font-mono">₹1,24,500</span>  {/* recreating AmountDisplay */}
</div>
```

## AmountDisplay rules

```tsx
// Currency amounts ALWAYS go through AmountDisplay — never raw font-mono spans
<AmountDisplay amount={124500} currency="INR" size="lg" />
// Renders: ₹1,24,500 in DM Mono with correct Indian number formatting
```

## When a needed component doesn't exist

1. Check if a Radix primitive + RABOS tokens can compose it (see `react-aria-pattern`)
2. If not, propose the new component in the Decision Log before building it
3. Build it to the same standard as existing components (accessible, token-based, motion-safe)
4. Add it to this skill's inventory after building

## Forbidden

- Recreating `MetricCard`, `AmountDisplay`, or `AtlasButton` inline in a feature component
- Using raw `<img>` instead of Next.js `<Image>` anywhere in the frontend
- Adding a Figma component without a Code Connect mapping (log as open item if Code Connect unavailable)
- Hardcoding currency symbol or number formatting — use `AmountDisplay`
