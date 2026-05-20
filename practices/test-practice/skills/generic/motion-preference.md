---
id: motion-preference
title: "Motion preference — prefers-reduced-motion compliance pattern"
layer: generic
tags: [accessibility, animation, motion, css, react, wcag, eu-accessibility]
applies_to:
  task_types: [add-component, add-animation, add-ui]
  stages: [4, 8]
size_tokens: 200
related: [accessibility-wcag, react-motion-library]
---

# motion-preference — Reduced Motion Compliance Pattern

## Pattern Summary

Every animation must respect `prefers-reduced-motion: reduce`. This is a WCAG 2.3.3 Level AA criterion and legally required under the EU Accessibility Act (June 2025). A component with animation that ignores this preference fails the Stage 8 gate.

## CSS pattern

```css
/* Define animation normally */
.card-enter {
  animation: slideIn 350ms cubic-bezier(0.16, 1, 0.3, 1);
}

/* Disable at the OS-level preference */
@media (prefers-reduced-motion: reduce) {
  .card-enter {
    animation: none;
    /* Optionally: instant opacity fade instead of motion */
    opacity: 0;
    animation: fadeIn 100ms linear;
  }
}
```

## React/Motion library hook

```typescript
import { useReducedMotion } from "motion/react";  // Motion library

export function AnimatedCard({ children }: { children: React.ReactNode }) {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReduced ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReduced ? 0.01 : 0.35,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
```

## Rules

- **Never animate position/scale without a reduced-motion fallback.** Vestibular disorders make spinning, scaling, and parallax physically painful.
- **Safe in reduced motion:** opacity transitions, colour transitions, border changes — these carry information without spatial movement.
- **Not safe in reduced motion:** translateX/Y, scale, rotate, parallax, scroll-triggered motion.
- **Test with DevTools:** Chrome → Rendering → Emulate CSS media feature `prefers-reduced-motion: reduce`.

## CI gate check

Add to accessibility audit script:
```bash
# Check that no keyframe animation lacks a prefers-reduced-motion override
grep -r "@keyframes" src/ | while read -r file; do
  if ! grep -q "prefers-reduced-motion" "$(echo "$file" | cut -d: -f1)"; then
    echo "MISSING reduced-motion override: $file"
    exit 1
  fi
done
```

## Forbidden

- `animation: X` in CSS without a `@media (prefers-reduced-motion: reduce)` counterpart
- `useSpring` / `useAnimate` without checking `useReducedMotion()` first
- Auto-playing looping animations (carousel, spinner) without a pause control
