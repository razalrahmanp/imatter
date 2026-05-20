---
id: react-aria-pattern
title: "React ARIA — accessible component primitives with Radix UI"
layer: stack
stack: react-supabase-lambda
tags: [react, accessibility, aria, radix-ui, keyboard, focus, a11y]
applies_to:
  task_types: [add-component, modify-component]
  stages: [4, 8]
size_tokens: 260
related: [accessibility-wcag, react-component, motion-preference]
context7_library_id: /radix-ui/primitives
---

# react-aria-pattern — Accessible React Component Pattern

## Pattern Summary

All interactive components use Radix UI primitives as the accessibility foundation. Never build custom dropdowns, dialogs, tooltips, or select controls from scratch — Radix provides the correct ARIA roles, keyboard navigation, and focus management already tested.

## Component → Radix mapping

| Component need | Radix primitive | Never build from scratch |
|---|---|---|
| Modal / dialog | `@radix-ui/react-dialog` | `<div>` with `role="dialog"` by hand |
| Dropdown menu | `@radix-ui/react-dropdown-menu` | `<ul>` triggered by button |
| Select input | `@radix-ui/react-select` | Custom styled `<select>` |
| Tooltip | `@radix-ui/react-tooltip` | `title` attribute or hover div |
| Checkbox | `@radix-ui/react-checkbox` | Custom div with click handler |
| Radio group | `@radix-ui/react-radio-group` | Styled divs with onClick |
| Popover | `@radix-ui/react-popover` | Absolutely positioned div |
| Tabs | `@radix-ui/react-tabs` | Div + manual aria-selected |

## Full accessible dialog example

```tsx
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";
import { useReducedMotion } from "motion/react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  open, onOpenChange, title, description, onConfirm,
}) => {
  const reduced = useReducedMotion();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Accessible overlay — Radix manages focus trap and Esc key */}
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />

        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     bg-surface rounded-lg p-6 w-full max-w-md
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-describedby="dialog-desc"
        >
          {/* Radix injects correct role="dialog" and aria-labelledby */}
          <Dialog.Title className="text-lg font-sans font-semibold text-text">
            {title}
          </Dialog.Title>

          <Dialog.Description id="dialog-desc" className="mt-2 text-sm text-muted">
            {description}
          </Dialog.Description>

          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="btn-secondary">Cancel</button>
            </Dialog.Close>
            <button onClick={onConfirm} className="btn-primary">
              Confirm
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
```

## Focus ring — universal rule

Every interactive element must have a visible `:focus-visible` ring:

```css
/* globals.css — applies to all interactive elements */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

Never add `outline: none` without a replacement. Never suppress `:focus-visible` for aesthetic reasons.

## Forbidden

- Building a dropdown, modal, or tooltip without a Radix primitive
- `role="button"` on a `<div>` — use `<button>`
- `onClick` without `onKeyDown` on a non-button element
- `tabIndex={-1}` on elements that should be keyboard-reachable
- Tooltip that only shows on hover (inaccessible to keyboard users — add focus trigger too)
