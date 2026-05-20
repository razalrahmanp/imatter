---
name: sdlc-motion-preference
description: Use when adding animations or transitions to a UI — honors prefers-reduced-motion, the kinds of motion that trigger vestibular issues, and the default that ships.
---

## Rule

Honor `prefers-reduced-motion`. Some users get motion sickness, vertigo, or migraines from parallax, large transitions, and rapid movement. The browser tells you when they've asked for less motion — respect it. Default ship: motion is subtle and short.

## Pattern — media query

```css
.fade-in {
  transition: opacity 300ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .fade-in {
    transition: none;
  }

  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

The blanket override at the bottom catches everything; specific overrides go above when you want a partial-motion variant.

## In JS / React

```tsx
const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

<motion.div
  animate={{ opacity: 1 }}
  transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
>
  ...
</motion.div>
```

Framer Motion, React Spring, etc. all honor `prefers-reduced-motion` via this pattern.

## What constitutes "bad" motion

| Bad | Why |
|---|---|
| Parallax (background moves at different rate than foreground) | Strongly triggers vestibular issues |
| Large translations / movements across screen | Same |
| Auto-playing videos with motion | Same |
| Carousel auto-rotation | Same |
| Spinning / rotating elements > brief loader | Disorientation |
| Bouncing / wobbling / shaking | Can trigger headaches |

What's generally fine (still respect the preference):
- Opacity fades
- Subtle color transitions
- Small translations (≤ a few px)
- Brief loading spinners
- Hover-state transitions

## Provide an opt-out in-app too

`prefers-reduced-motion` is the OS / browser setting. Also offer it in your app settings:

```
Settings → Accessibility → Reduce motion [ on / off ]
```

Some users have specific apps where they want motion (TikTok-style) and others where they don't.

## Defaults to ship

| Pattern | Duration |
|---|---|
| Hover state change | 100–150ms |
| Focus ring appear | 0–100ms (instant or near-instant) |
| Modal open | 200ms ease-out |
| Modal close | 150ms ease-in |
| Toast slide-in | 250ms ease-out |
| Page transition | 200–300ms |
| Heavy / hero animations | Avoid unless intentional brand expression |

Easings: prefer ease-out (or cubic-bezier(0, 0, 0.2, 1)) for entrances; ease-in for exits. Bouncy easings are fun for marketing pages, distracting in apps.

## Animation > motion: what's the difference

| Concept | Example | OK by default? |
|---|---|---|
| Animation (color change, fade) | Hover background change | Yes |
| Motion (position change, scaling) | Slide-in panel, modal that grows | Subtle is OK; large transformations are not |
| Parallax | Background scrolls slower | Should be opt-in only |

`prefers-reduced-motion` is about *motion* specifically (transforms, scrolls, parallax). Color and opacity changes are usually fine, though some implementations disable all transitions for simplicity.

## Triggering vestibular issues

About 7% of adults have a vestibular disorder. For them, parallax and large motion can trigger:

- Dizziness
- Vertigo
- Migraine
- Nausea

The setting exists to spare them. Honor it.

## Anti-patterns

- ❌ Ignoring `prefers-reduced-motion`
- ❌ Carousel auto-rotation with no pause control
- ❌ Parallax effect with no escape
- ❌ "Cool" landing-page animations that disorient users
- ❌ Animations triggering layout (`width`, `height`, `top`) instead of transform / opacity — bad for perf AND motion
- ❌ Spinners that spin so fast they trigger seizures (rare but possible)
- ❌ Auto-play video at top of page

## Cross-references

- [[sdlc-accessibility-wcag]] — WCAG 2.1 Success Criterion 2.3.3 (Animation from Interactions)
- [[sdlc-react-motion-library]] — React-specific patterns
- [[sdlc-design-system-tokens]] — motion tokens (`motion.duration.fast`)

## Gate criteria

- `prefers-reduced-motion: reduce` is honored at the CSS level
- No autoplay video / carousel auto-rotation without pause control
- No parallax / large-translation effects on default ship
- Motion duration ≤ 300ms for most interactions
- In-app accessibility setting to manually toggle reduced motion
- A test verifies media-query honoring (Playwright can emulate)
