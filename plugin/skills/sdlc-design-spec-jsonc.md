---
name: sdlc-design-spec-jsonc
description: Use when handing off a UI design from designer to engineer — covers the structured JSONC design-spec format that captures intent precisely enough to implement without ambiguity.
---

## Rule

A design spec in JSONC (JSON with comments) form pins down what each piece of UI looks like and how it behaves. It is the bridge between Figma and code. Vague specs cause drift; structured specs make implementation mechanical.

## Why JSONC

- **Comments**: explain intent inline (`// Cap copy at 60 chars`)
- **Structured**: machine-readable; can power tooling
- **Diff-friendly**: tracks UI changes alongside code
- **Single source**: designer + engineer reference the same file

Alternatives (YAML, TOML, JSON5) work too. The point is structured + commented.

## Example spec

```jsonc
{
  "component": "Button",
  "purpose": "Primary user action; one per important section",
  "variants": ["primary", "secondary", "ghost"],
  "sizes": ["sm", "md", "lg"],
  "states": ["default", "hover", "active", "disabled", "loading"],
  "tokens": {
    "primary": {
      "default": { "bg": "color.action.primary", "fg": "color.text.inverted" },
      "hover":   { "bg": "color.action.primary.hover", "fg": "color.text.inverted" },
      "active":  { "bg": "color.action.primary.active", "fg": "color.text.inverted" }
    }
  },
  "spacing": {
    "padding": { "sm": "space.2 space.3", "md": "space.3 space.4", "lg": "space.4 space.5" }
  },
  "typography": {
    "sm": "text.button.sm",
    "md": "text.button",
    "lg": "text.button.lg"
  },
  "radius": "radius.md",
  "icon": {
    "position": "left",       // or "right"
    "size": { "sm": "16px", "md": "20px", "lg": "24px" }
  },
  "behavior": {
    "onPress": "fires onClick prop",
    "loading": "shows spinner replacing label; disables click",
    "disabled": "non-interactive; reduced opacity; cursor: not-allowed",
    "keyboard": "Enter and Space activate; Tab to focus"
  },
  "accessibility": {
    "role": "button",
    "ariaPressed": "for toggle variants only",
    "minTouchTarget": "44x44 px",
    "focusVisible": "2px solid currentColor offset 2px"
  },
  "responsive": {
    "mobile": "full-width by default in primary CTAs",
    "desktop": "auto-width"
  },
  "examples": [
    { "props": { "variant": "primary", "size": "md" }, "label": "Place order" },
    { "props": { "variant": "secondary", "size": "sm", "icon": "plus" }, "label": "Add item" }
  ]
}
```

## What to include

| Section | Purpose |
|---|---|
| **purpose** | Why this component exists; when to use it |
| **variants / sizes / states** | The dimensions of variation |
| **tokens** | Design-system token references per state (see [[sdlc-design-system-tokens]]) |
| **spacing / typography / radius** | The visual specifics |
| **behavior** | What happens on interaction |
| **accessibility** | ARIA, focus, keyboard, touch target |
| **responsive** | How it adapts to viewport |
| **examples** | Concrete usage |

## What NOT to include

- Pixel-perfect values when tokens exist (use the token name; don't hard-code)
- Implementation details (which React library, which CSS-in-JS)
- Copy / content (that's the responsibility of the content layer)

## How to use

1. **Designer authors** the spec from Figma, alongside the visual mockups
2. **Engineer reads** the spec to implement
3. **Spec lives in the repo** at `docs/design/components/<name>.jsonc`
4. **PR review** can reference the spec ("the spec says hover bg is `color.action.primary.hover` — code matches")
5. **Drift audit** ([[sdlc-design-drift-audit]]) periodically checks production UI against the spec

## When a component has no spec

Then you don't yet have a system. Either:
- Pause; spec it first
- Implement as a one-off (knowing you'll need to retrofit when it appears again)

The three-times rule from [[sdlc-simplicity-first]]: spec a component when it appears the third time. Spec a design system from day one if you know you'll build many components.

## Anti-patterns

- ❌ Implementing from Figma screenshot alone (loses intent)
- ❌ Spec in Notion / Confluence (drifts from code; bad diffs)
- ❌ Spec covers visual only, not behavior or accessibility
- ❌ Spec hard-codes pixel values instead of tokens
- ❌ Spec written after code (rationalization, not specification)
- ❌ Spec for every component including trivial ones (overhead)
- ❌ No "purpose" field — readers can't tell when this component is appropriate

## Cross-references

- [[sdlc-design-system-tokens]] — the tokens referenced
- [[sdlc-design-drift-audit]] — keeping spec and reality aligned
- [[sdlc-accessibility-wcag]] — accessibility requirements
- [[sdlc-react-component]] — implementation companion

## Gate criteria

- Every shared component has a spec in JSONC (or equivalent structured form)
- Specs reference tokens, not pixel values
- Specs include behavior + accessibility, not just visuals
- Specs live in source control with the code
- A drift audit job verifies code matches spec for sampled components
- Designers and engineers both read and update the spec
