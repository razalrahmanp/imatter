---
name: sdlc-react-motion-library
description: Use when adding non-trivial animations to a React app — covers picking a motion library, the animation patterns that ship well, and how to keep motion accessible.
---

## Rule

For trivial animations (CSS transitions on hover), use CSS. For complex sequences (orchestrated entrances, layout animations, gesture-driven motion), use a library — typically Framer Motion. Honor `prefers-reduced-motion`. Most apps need very little animation; resist the urge to over-animate.

## Pick a library

| Library | Strengths |
|---|---|
| **Framer Motion** | Industry standard; orchestration, layout animations, gestures; rich docs |
| **React Spring** | Spring physics primitives; lower-level |
| **Auto Animate** | Magic-zero-config drop-in for list animations |
| **CSS animations only** | Best for simple transitions; lowest cost |

For most apps: Framer Motion + occasional Auto Animate.

## What CSS handles fine

```css
.button {
  background: var(--color-action-primary);
  transition: background 150ms ease, transform 100ms ease;
}

.button:hover {
  background: var(--color-action-primary-hover);
  transform: translateY(-1px);
}
```

No library needed. CSS handles hover, focus, disabled state transitions perfectly. Don't reach for a library for these.

## What needs a library

| Pattern | Library reason |
|---|---|
| **Orchestrated entrance** | Staggered children, parent → child timing |
| **Exit animations** | CSS can't animate elements unmounting; library can |
| **Layout animations** | Moving from one position to another smoothly when list reorders |
| **Gesture-driven** | Drag, pinch, swipe with physics |
| **Path morphing (SVG)** | Tween between SVG shapes |
| **Conditional motion** | Dynamic durations / easings based on state |

## Pattern — Framer Motion entrance

```tsx
import { motion } from "framer-motion";

function Card({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
```

For lists with staggered children:

```tsx
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

<motion.ul variants={containerVariants} initial="hidden" animate="show">
  {items.map((item) => (
    <motion.li key={item.id} variants={itemVariants}>
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

## Pattern — exit animations

```tsx
import { AnimatePresence, motion } from "framer-motion";

<AnimatePresence>
  {open && (
    <motion.div
      key="toast"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
    >
      Toast content
    </motion.div>
  )}
</AnimatePresence>
```

`AnimatePresence` keeps the element in DOM during exit animation, then unmounts.

## Pattern — layout animations

```tsx
<motion.div layout>
  {/* Whatever this is, when its position changes, animate to new position */}
</motion.div>
```

For lists where items reorder. The library calculates before/after positions and animates between them. Magical for the right use cases.

## Honor reduced motion

See [[sdlc-motion-preference]].

```tsx
import { useReducedMotion } from "framer-motion";

const prefersReduced = useReducedMotion();

<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: prefersReduced ? 0 : 0.2 }}
>
  ...
</motion.div>
```

Or globally configure the library to honor `prefers-reduced-motion` by default.

## Performance tips

| Tip | Why |
|---|---|
| Animate `transform` and `opacity` only | Composited; doesn't trigger layout |
| Avoid `width`, `height`, `top`, `left` | Layout-triggering; janky |
| Use `will-change` sparingly | Hints to browser; overuse hurts |
| Reduce simultaneous animations | Many concurrent animations = jank |
| Memoize animated components | Avoid re-renders during animation |

## Bundle size

Framer Motion is ~30 KB gzipped at the time of writing. Worth it if used; expensive if used for one trivial hover effect.

| Bundle option | Use |
|---|---|
| `framer-motion` | Full library |
| `framer-motion/m` (lazy / modular) | Smaller subset for simple cases |

See [[sdlc-bundle-budget]] for budget impact.

## When NOT to add motion

- Marketing CTAs that already convert well (don't fix what works)
- Frequent UI changes (every interaction animated = noise)
- Critical paths where speed matters (signup, checkout)
- Mobile (motion is more disruptive on small screens)

## Anti-patterns

- ❌ Library used for hover state changes (CSS suffices)
- ❌ No `prefers-reduced-motion` honor
- ❌ 5-second hero animations on landing pages
- ❌ Animations that block interaction (user has to wait for animation)
- ❌ Layout-triggering animations on mobile
- ❌ Spring physics tuned to "fun" but visually distracting in productivity UI
- ❌ Different motion libraries in the same app
- ❌ Motion durations > 300ms for routine interactions

## Cross-references

- [[sdlc-motion-preference]] — `prefers-reduced-motion`
- [[sdlc-design-system-tokens]] — motion duration tokens
- [[sdlc-accessibility-wcag]] — WCAG 2.3.3 Animation from Interactions
- [[sdlc-bundle-budget]] — library cost

## Gate criteria

- One motion library chosen and used consistently
- `prefers-reduced-motion` honored globally
- Animations under 300ms for routine UI
- No layout-triggering animations on critical paths
- Bundle impact tracked against budget
- Motion durations come from tokens, not inline magic values
- No multiple-second blocking animations on app shell
