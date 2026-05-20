---
name: sdlc-accessibility-wcag
description: Use when building or auditing any user-facing UI — applies WCAG 2.1 Level AA criteria for the common cases (keyboard, contrast, alt text, focus management) without drowning in the full standard.
---

## Rule

Every user-facing UI ships with WCAG 2.1 Level AA conformance as a baseline. AA is the legal standard in most jurisdictions (EAA in EU, ADA-aligned in US, AODA in Ontario, BITV in Germany). Build for it from day one — retrofitting is dramatically more expensive.

## The four POUR principles

WCAG groups criteria under four pillars:

| Principle | Question |
|---|---|
| **Perceivable** | Can the user sense the content? |
| **Operable** | Can the user interact with it? |
| **Understandable** | Can the user comprehend it? |
| **Robust** | Will assistive tech work reliably? |

## The 80% — what catches most issues

Most accessibility bugs fall into these categories. Fix these first.

### 1. Keyboard operability

Every interactive element must be reachable via Tab, and the action must be triggerable via Enter or Space.

```html
<!-- ❌ Wrong — div is not focusable, click is not keyboard-accessible -->
<div onclick="submit()">Submit</div>

<!-- ✅ Right — semantic button -->
<button type="button" onclick="submit()">Submit</button>

<!-- ✅ Right — if it MUST be a div: -->
<div role="button" tabindex="0" onClick="submit()" onKeyDown="if (e.key === 'Enter' || e.key === ' ') submit()">Submit</div>
```

Default to semantic HTML. `<button>`, `<a href>`, `<input>` come with keyboard support for free.

### 2. Focus visibility and order

When tabbing through, the current element must be visually distinguished, and the order must match the visual layout.

```css
/* Don't remove focus rings */
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* ❌ Don't do this without an alternative */
* { outline: none; }
```

Test: open the page, hit Tab repeatedly. You should always see where focus is, and the order should be logical.

### 3. Text alternatives

Every meaningful image has alt text. Decorative images have empty alt (not omitted).

```html
<!-- Meaningful -->
<img src="chart.png" alt="Revenue grew 40% Q1 to Q2 2025">

<!-- Decorative (background, ornamental) -->
<img src="divider.png" alt="">

<!-- Functional (icon button) -->
<button aria-label="Close dialog">
  <svg>...</svg>
</button>
```

For complex images (charts, diagrams), provide alt summarizing the insight, and a longer description nearby.

### 4. Color contrast

Text must have contrast ratio ≥ 4.5:1 against its background (normal text) or ≥ 3:1 (large text ≥ 18pt / 14pt bold). UI elements (icons, focus indicators) need ≥ 3:1.

Tools: WebAIM contrast checker, Stark, browser DevTools accessibility panel.

```css
/* ❌ Likely fails on a white background */
color: #aaa;

/* ✅ Passes 4.5:1 on white */
color: #595959;
```

### 5. Don't rely on color alone

A red dot to indicate "error" is invisible to color-blind users and to assistive tech. Add a label, icon, or pattern.

```html
<!-- ❌ Color alone -->
<span style="color: red;">●</span> Failed

<!-- ✅ Color + icon + text -->
<span style="color: red;">✖ Failed</span>
```

### 6. Form labels

Every input has a label. Placeholder is not a label.

```html
<!-- ❌ Wrong — placeholder disappears when typing -->
<input placeholder="Email">

<!-- ✅ Right -->
<label for="email">Email</label>
<input id="email" type="email">

<!-- ✅ Also right -->
<label>
  Email
  <input type="email">
</label>
```

Required fields: indicate visually AND in `aria-required="true"` or via `required`. Error messages: programmatically associate via `aria-describedby`.

### 7. Headings hierarchy

Use heading levels correctly. Don't skip levels for styling.

```html
<h1>Page title</h1>
  <h2>Section</h2>
    <h3>Subsection</h3>
  <h2>Another section</h2>
```

Screen readers navigate by heading level. A page with no `<h1>` or with mis-nested headings is hard to scan.

### 8. Live regions for async updates

When content changes without a page reload (loading states, validation errors, toast notifications), announce it:

```html
<div role="status" aria-live="polite">
  Loading...
</div>

<div role="alert" aria-live="assertive">
  Error: connection failed
</div>
```

`polite`: announced when screen reader is idle.
`assertive`: interrupts the current announcement — use sparingly, only for genuinely urgent.

### 9. Skip link

For pages with significant navigation, offer a skip link at the start:

```html
<a href="#main" class="skip-link">Skip to main content</a>
...
<main id="main">...</main>
```

Style it visible only on focus.

### 10. Reduced motion

Honor `prefers-reduced-motion`:

```css
.fade-in { transition: opacity 300ms; }

@media (prefers-reduced-motion: reduce) {
  .fade-in { transition: none; }
}
```

Same for autoplay, parallax, heavy animations.

## Testing

| Tool | What it catches |
|---|---|
| **axe DevTools** (browser extension) | Automated checks — about 30–40% of issues |
| **Lighthouse accessibility audit** | Same category |
| **Manual keyboard test** | Tab-trap, focus loss, unreachable elements |
| **Screen reader test** (NVDA on Windows, VoiceOver on Mac) | Announcement clarity, semantic correctness |
| **Color contrast checker** | Automated + visual |
| **High-contrast mode** (Windows / macOS) | Custom colors that look fine but break in HC mode |
| **Real user testing** (accessibility consultant) | The remaining 60% no tool catches |

Automated tooling alone covers ~30%. The rest needs manual review. Build in time for it.

## Anti-patterns

- ❌ "We'll add accessibility later" (retrofit is 10× the work)
- ❌ Custom div-based "buttons" without `role` and keyboard handling
- ❌ Placeholder as the only label
- ❌ Icon-only buttons with no `aria-label`
- ❌ `outline: none` without an alternative focus indicator
- ❌ Modals that don't trap focus and don't restore focus on close
- ❌ Carousels that autoplay without a pause button
- ❌ Validation errors only in red without text
- ❌ Tooltips that disappear on mouseout but never reappear for keyboard users
- ❌ Charts with no text alternative
- ❌ Login forms with `autocomplete="off"` (breaks password managers, accessibility)

## Gate criteria

- A WCAG 2.1 AA conformance statement is committed and updated per release
- Every page passes `axe-core` automated checks with zero violations
- Every interactive element is reachable and operable via keyboard
- Color contrast ≥ 4.5:1 verified for all text
- Forms have programmatic labels and accessible error messages
- Live regions announce loading and error states
- Reduced motion preference is honored
- A periodic manual audit (quarterly, or per major release) checks the 60% automated tools miss
- A `docs/accessibility.md` exists with known limitations and the remediation plan
