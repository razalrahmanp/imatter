---
name: sdlc-react-aria-pattern
description: Use when building accessible interactive components (menus, dialogs, comboboxes, tabs) in React — covers the React Aria / Radix UI patterns vs. hand-rolling, and the ARIA primitives that matter.
---

## Rule

Don't hand-roll accessibility for complex interactive components. Use a primitives library (React Aria, Radix UI, Headless UI) that has handled the keyboard, ARIA, and focus management for you. Custom styling on top, not custom behavior underneath.

## When to use a primitives library

Always, for these components:

| Component | Why complex |
|---|---|
| Dialog / Modal | Focus trap, restore focus, ESC, backdrop, scroll lock |
| Dropdown / Menu | Roving tabindex, arrow nav, type-ahead, escape |
| Combobox / Autocomplete | Listbox semantics, aria-activedescendant, screen-reader announcements |
| Tabs | Roving tabindex, arrow nav, panel association |
| Toast / Notification | Live region, polite vs assertive, dismiss timing |
| Slider | Drag, arrow keys, percentage announce, keyboard increment |
| Date picker | Calendar grid, focus management, locale handling |
| Switch | Distinct from checkbox; role="switch" |
| Tree | Roving tabindex through tree levels |

Hand-rolling these correctly is months of work. Don't.

## Library picks

| Library | Strengths | Considerations |
|---|---|---|
| **React Aria (Adobe)** | Behavior + ARIA only, fully unstyled; rigorous a11y | More boilerplate, fewer pre-built compositions |
| **Radix UI** | Compound components, well-tested, easy DX | Some primitives less feature-complete |
| **Headless UI (Tailwind Labs)** | Pairs with Tailwind, simple API | Fewer primitives |
| **Ariakit** | Comprehensive, ARIA APG-aligned | Smaller community |
| **shadcn/ui** | Pre-styled (uses Radix under the hood); copy-paste | You own the code; updates require manual sync |

Pick one. Don't mix Radix with React Aria — they have different mental models, you'll be confused.

## Pattern — Radix Dialog example

```tsx
import * as Dialog from "@radix-ui/react-dialog";

function ConfirmDialog({ open, onOpenChange, title, description, onConfirm }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          <Dialog.Close asChild>
            <button>Cancel</button>
          </Dialog.Close>
          <button onClick={onConfirm}>Confirm</button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

Radix handles:
- Focus trap inside dialog
- ESC closes
- Backdrop click closes
- Scroll lock
- ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`)
- Focus restoration on close

## When hand-rolling is OK

Simple things:

- Button (`<button>` is accessible — just style it)
- Link (`<a href>`)
- Form input (`<input>` + `<label for>`)
- Checkbox (`<input type="checkbox">`)
- Radio group (with shared `name`)

The browser handles these. Don't rebuild them as `<div role="button">`.

## ARIA primitives — when you need raw

If you genuinely need a custom widget the library doesn't cover, follow ARIA Authoring Practices Guide (APG) exactly:

| Attribute | Use |
|---|---|
| `role` | What the element is (button, dialog, menu, listbox) |
| `aria-label` | Accessible name when no visible label |
| `aria-labelledby` | Reference to element providing the name |
| `aria-describedby` | Reference to element providing description |
| `aria-expanded` | Toggleable container (menu, accordion) |
| `aria-pressed` | Toggle buttons |
| `aria-checked` | Custom checkboxes / switches |
| `aria-selected` | Listbox / tablist items |
| `aria-activedescendant` | Composite widgets where focus is on container |
| `aria-live` | Live regions for announcements |

Test with a screen reader (VoiceOver on macOS, NVDA on Windows). Reading the spec ≠ verifying it works.

## Focus management

Three rules:

1. **Visible focus indicator** always — don't `outline: none` without a replacement
2. **Restore focus on close** — when a modal closes, focus returns to the trigger
3. **No focus loss** — focus should never disappear into `<body>`

Libraries handle these for you. Hand-rolling — be vigilant.

## Anti-patterns

- ❌ `<div onClick={...}>` instead of `<button>`
- ❌ Custom dropdown that doesn't open with Enter / Space
- ❌ Modal without focus trap (Tab escapes to background page)
- ❌ Modal that doesn't restore focus on close
- ❌ `aria-label` on something that already has visible text (clobbers)
- ❌ `aria-hidden="true"` on focusable elements (still focusable; gives nothing to screen readers)
- ❌ Multiple primitives libraries in the same app
- ❌ "We'll add accessibility later" (retrofit is 10× the work)

## Cross-references

- [[sdlc-accessibility-wcag]] — WCAG 2.1 AA compliance baseline
- [[sdlc-react-component]] — React component shape
- [[sdlc-react-error-boundary]] — error boundaries don't block focus

## Gate criteria

- One primitives library chosen and used consistently
- No custom div-based "buttons" / "modals" without ARIA equivalent
- All complex interactions (menu, dialog, combobox, slider) use library primitives
- Screen-reader tested (VoiceOver / NVDA) for critical user flows
- Focus restoration verified for every modal / drawer
- Visible focus indicator on every interactive element
