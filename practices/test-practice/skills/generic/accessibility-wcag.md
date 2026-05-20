---
id: accessibility-wcag
title: "Accessibility — WCAG 2.1 AA checklist for web UI"
layer: generic
tags: [accessibility, wcag, aria, keyboard, contrast, a11y, compliance]
applies_to:
  task_types: [add-component, add-page, add-ui, modify-component]
  stages: [4, 8]
size_tokens: 290
related: [react-aria-pattern, motion-preference, design-system-tokens]
---

# accessibility-wcag — WCAG 2.1 AA Compliance Pattern

## Pattern Summary

Every UI component must satisfy WCAG 2.1 Level AA before shipping. Non-compliance is a legal liability in EU, US, UK, CA, and AU. Run `/fixing-accessibility` (Frontend Design) after every UI change.

**Non-negotiable criteria:**

### 1. Colour contrast
- **Normal text:** minimum 4.5:1 contrast ratio against background
- **Large text (≥18pt or ≥14pt bold):** minimum 3:1
- **UI components and focus indicators:** minimum 3:1

```
navy-950 (#0A0E1A) + white (#E8E8E8)  → 14.5:1 ✅
navy-950 (#0A0E1A) + gold-500 (#D97706) → 5.2:1 ✅
navy-900 (#0F172A) + navy-300 (#94A3B8) → 4.8:1 ✅ (muted labels OK)
navy-800 (#1E293B) + navy-300 (#94A3B8) → 3.7:1 ⚠️ (only for decorative or large text)
```

### 2. Keyboard navigation
- Every interactive element reachable via Tab in logical order
- No keyboard trap (can always Tab out of a widget)
- Visible focus indicator on every focused element (not `outline: none` without replacement)
- Arrow keys navigate within compound widgets (menu, tabs, radio group, listbox)

### 3. Semantic HTML + ARIA
- Use native HTML elements first (`<button>`, `<a>`, `<input>`) — ARIA only when native is insufficient
- Correct roles: `role="dialog"`, `role="alert"`, `role="status"`, `role="menu"` etc.
- Every form input has a visible `<label>` or `aria-label` or `aria-labelledby`
- Dynamic content changes announced: `aria-live="polite"` (non-urgent) or `"assertive"` (urgent errors)
- Images: meaningful → `alt="description"`; decorative → `alt=""`

### 4. Focus management
- Modal dialogs: focus moves to dialog on open, returns to trigger on close
- Toast/alert: announced via `aria-live`, does not steal focus
- Single-page navigation: focus moves to new page heading on route change

### 5. Reduced motion
- Any animation respects `prefers-reduced-motion: reduce` — see `motion-preference` skill
- No content flashes more than 3 times per second (seizure threshold)

## Verification approach

```bash
# In CI — runs Lighthouse accessibility audit
npx lighthouse <url> --only-categories=accessibility --output=json

# In browser dev tools — axe-core
npx axe <url>

# Manual checks (automated tools miss ~30% of issues)
# 1. Tab through entire page — verify logical order and no traps
# 2. Screen reader smoke test (VoiceOver/NVDA) — read key flows aloud
# 3. Zoom to 200% — verify no horizontal scroll, no content cut off
```

## Gate evidence (Stage 4 / Stage 8)

| Criterion | Evidence |
|---|---|
| Contrast meets 4.5:1 for body text | Lighthouse score ≥ 90 AND manual spot-check on muted palette tokens |
| Keyboard nav complete | Manual Tab-through video or screenshot sequence |
| All inputs labelled | `axe --rules=label` zero violations |
| Focus management on modals | Manual test confirmed in session log |
| Reduced motion respected | `motion-preference` skill cited; test with `prefers-reduced-motion: reduce` in DevTools |

## Forbidden

- `outline: none` without a visible custom focus indicator (`:focus-visible` required)
- `aria-hidden="true"` on interactive elements
- `tabindex > 0` (breaks natural tab order)
- Colour as the only differentiator (e.g. red = error with no icon or text)
- Auto-playing audio or video without a mute control
