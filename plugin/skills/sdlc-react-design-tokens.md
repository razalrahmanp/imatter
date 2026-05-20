---
name: sdlc-react-design-tokens
description: Use when consuming design tokens in React components — covers the consumption patterns (CSS vars, Tailwind, CSS-in-JS) and the rules that prevent token bypass.
---

## Rule

React components consume design tokens through a single mechanism — pick CSS variables, Tailwind, or CSS-in-JS. Don't mix. Tokens are referenced by name, never as literal values. The lint rule blocks new hex / px literals.

## Pattern — CSS variables (recommended default)

```css
/* tokens.css — generated from JSONC tokens via Style Dictionary */
:root {
  --color-action-primary: #4F46E5;
  --color-text-default: #111827;
  --space-3: 12px;
  --space-4: 16px;
  --radius-md: 8px;
  --font-size-body: 16px;
}
```

```tsx
function Button({ children }: ButtonProps) {
  return (
    <button
      style={{
        background: "var(--color-action-primary)",
        color: "var(--color-text-default)",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        fontSize: "var(--font-size-body)",
      }}
    >
      {children}
    </button>
  );
}
```

Inline `style` is concise; for many properties prefer a className with a CSS module / utility class.

## Pattern — Tailwind with token mapping

```js
// tailwind.config.js
const tokens = require("./design-tokens/dist/tokens.json");

module.exports = {
  theme: {
    colors: {
      "action-primary": tokens.color.action.primary.value,
      "text-default": tokens.color.text.default.value,
    },
    spacing: {
      3: tokens.space[3].value,
      4: tokens.space[4].value,
    },
    borderRadius: {
      md: tokens.radius.md.value,
    },
    fontSize: {
      body: tokens.font.size.body.value,
    },
  },
};
```

```tsx
function Button({ children }: ButtonProps) {
  return (
    <button className="bg-action-primary text-text-default px-4 py-3 rounded-md text-body">
      {children}
    </button>
  );
}
```

Pros: utility classes, scannable, easy to enforce no-hex.
Cons: classes can grow long for complex components.

## Pattern — CSS-in-JS (styled-components, vanilla-extract)

```tsx
import { styled } from "@vanilla-extract/sprinkles";

const Button = styled("button", {
  background: vars.color.action.primary,
  color: vars.color.text.default,
  padding: `${vars.space[3]} ${vars.space[4]}`,
  borderRadius: vars.radius.md,
});
```

Pros: type-safe, IDE autocomplete.
Cons: heavier tooling; runtime cost varies.

## Picking one

| If you're starting | Recommend |
|---|---|
| New project, mostly utility-first | Tailwind |
| Component library, theme-able | CSS vars + CSS modules |
| TypeScript-heavy, strong type safety | Vanilla Extract or stitches |
| Existing legacy CSS | CSS vars (gradual adoption) |

**Pick one, commit, stop relitigating.**

## Enforcement — lint rules

ESLint plugin example for "no hex in JSX style":

```js
// .eslintrc.js
rules: {
  "no-restricted-syntax": [
    "error",
    {
      selector: "JSXAttribute[name.name='style'] Literal[value=/^#[0-9a-fA-F]{3,6}$/]",
      message: "Hex colors are forbidden; use design tokens.",
    },
  ],
}
```

For Tailwind: configure `safelist` to only allow your token-derived classes; arbitrary values (`bg-[#FF0000]`) generate warnings.

For raw CSS: stylelint with custom rules.

The lint rule is the teeth. Without it, tokens get bypassed.

## Themed components

Tokens enable themes — same code, different visual styling per theme:

```css
:root {
  --color-action-primary: #4F46E5;        /* light theme */
}

[data-theme="dark"] {
  --color-action-primary: #8B86FF;        /* dark theme */
}
```

Components don't change; they read `var(--color-action-primary)` and get whichever is active.

Don't hardcode color choices in components — even small "just a darker blue here" decisions break theming.

## When to depart from tokens

| Case | What |
|---|---|
| Marketing one-off campaign | Add a campaign-token: `--color-campaign-spring-coral` |
| Prototype / spike | Allowed; add `@allow-hex` comment; remediate before merging |
| Embedded vendor widget | Vendor's own styling; document the boundary |
| Animation interpolation (CSS keyframes blending colors) | Tokens at start/end; native interpolation in between |

Default: every new color, spacing, radius referenced from tokens. If you need a new value, add it to the token system, then use it.

## Anti-patterns

- ❌ Multiple consumption mechanisms (Tailwind + CSS-in-JS + raw CSS) — drift compounds
- ❌ Hex colors in component code
- ❌ Magic spacing values (`margin: 7px`)
- ❌ Tokens defined locally per component (no sharing)
- ❌ Tailwind config not derived from token source (drift between Tailwind and tokens.json)
- ❌ No lint enforcement (tokens get bypassed)
- ❌ One-off campaign colors that become permanent without tokenization
- ❌ Themes implemented by duplicating components

## Cross-references

- [[sdlc-design-system-tokens]] — what tokens look like
- [[sdlc-design-spec-jsonc]] — token references in component specs
- [[sdlc-react-component]] — component shape
- [[sdlc-design-drift-audit]] — finding token bypass

## Gate criteria

- One consumption mechanism chosen and documented
- Token source (JSONC / JSON) is the single source; Tailwind / CSS / JS configs are derived from it
- Lint rule forbids hex colors and magic spacings in component code
- Components reference tokens by name, not by literal value
- Theme switching works for any supported theme via token swap
- A drift audit (manual or automated) finds bypassed tokens periodically
