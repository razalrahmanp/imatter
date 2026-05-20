---
id: react-motion-library
title: "React motion — Motion library pattern (GPU-only, reduced-motion safe)"
layer: stack
stack: react-supabase-lambda
tags: [react, animation, motion, framer-motion, performance, reduced-motion]
applies_to:
  task_types: [add-component, add-animation, modify-component]
  stages: [4, 9]
size_tokens: 240
related: [motion-preference, react-aria-pattern, web-vitals]
context7_library_id: /motiondivision/motion
---

# react-motion-library — React Motion Animation Pattern

## Pattern Summary

Animations use Motion library (`motion/react`). All animations are GPU-accelerated (transform + opacity only). All animations respect `useReducedMotion()`. No animation ships without passing both rules.

## Import

```typescript
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
```

## Standard animation variants

```typescript
// src/frontend/lib/motion-variants.ts
import { useReducedMotion } from "motion/react";

// Use these variants across the app — do not reinvent per component
export const fadeUp = (reduced: boolean) => ({
  initial: { opacity: 0, y: reduced ? 0 : 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: reduced ? 0 : -8 },
  transition: {
    duration: reduced ? 0.01 : 0.35,
    ease: [0.16, 1, 0.3, 1],
  },
});

export const fadeIn = (reduced: boolean) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: reduced ? 0.01 : 0.2 },
});
```

## Component usage pattern

```tsx
import { motion } from "motion/react";
import { useReducedMotion } from "motion/react";
import { fadeUp } from "@/lib/motion-variants";

export const InsightCard: FC<{ insight: Insight }> = ({ insight }) => {
  const reduced = useReducedMotion();
  const variants = fadeUp(reduced ?? false);

  return (
    <motion.div
      className="bg-surface rounded-md p-4"
      {...variants}
    >
      <p className="font-sans text-text">{insight.summary}</p>
    </motion.div>
  );
};
```

## List animation (stagger)

```tsx
<AnimatePresence mode="popLayout">
  {items.map((item, i) => (
    <motion.li
      key={item.id}
      {...fadeUp(reduced ?? false)}
      transition={{ ...fadeUp(reduced ?? false).transition, delay: reduced ? 0 : i * 0.04 }}
    >
      <ItemRow item={item} />
    </motion.li>
  ))}
</AnimatePresence>
```

## GPU-only rule

Only animate these properties — they run on the GPU compositor thread:
- `opacity`
- `transform` (`x`, `y`, `scale`, `rotate`) — use Motion's shorthand, not raw CSS

Never animate these (forces CPU layout recalculation):
- `width` / `height` — use `scaleX` / `scaleY` instead
- `top` / `left` / `margin` / `padding`
- `border-width` / `border-radius` (small animations OK, layout-triggering sizes not)

## Forbidden

- Using `useReducedMotion()` without passing its result to duration/offset
- `duration` values above 600ms for UI micro-interactions
- Animating layout properties (`width`, `height`, `top`, `left`)
- `AnimatePresence` without `mode="popLayout"` in lists (causes jump on item removal)
