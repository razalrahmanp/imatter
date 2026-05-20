---
name: sdlc-frontend-design
description: Use when implementing any UI-facing feature in an SDLC project — enforces design direction commitment before code generation and four-pass verification after.
---

# sdlc-frontend-design

## When to invoke

Invoke at the start of any coding task that produces or modifies a browser-visible UI element — component, page, modal, form, animation. Do not invoke for backend-only tasks.

Invoked automatically by `sdlc-dispatcher` when task type is `add-component`, `modify-component`, `add-page`, or `add-ui`.

## Step 1 — Acquire design source

Check in this order:

1. **Figma URL provided?** → call `sdlc-figma` to read frame data. Skip to Step 3.
2. **`design-spec.jsonc` exists** in project root or feature folder? → read it. Skip to Step 3.
3. **Neither exists** → run Frontend Design's `/frontend-design` command to generate a spec. The spec becomes the design source for this task. Write it to `design-spec.jsonc` before generating any code.

**Never generate UI code without a design source.** This is the single most common cause of generic, low-quality AI-generated interfaces.

## Step 2 — Apply brand constraints (if RABOS project)

If the project overlay is `rabos`, load `rabos-brand-system` and `rabos-component-library` skills before generating code. They constrain Frontend Design's aesthetic direction:

- Palette is fixed: navy-950 → navy-700 + gold-500/400. No other choices.
- Typography is fixed: DM Sans / DM Mono / Fraunces. No other fonts.
- Dark mode is default. Never generate light-first components for RABOS.

For non-RABOS projects: Frontend Design's aesthetic direction is open. Commit to one direction early and do not drift within the task.

## Step 3 — Anti-convergence rules (all projects)

Before writing a single line of UI code, confirm the design direction does NOT use:

| Generic pattern | Replacement |
|---|---|
| Inter, Roboto, Arial, system-ui as primary | A distinctive alternative: Geist, Sohne, Fraunces, DM Sans |
| Purple gradient on white | Brand-specific palette; never the AI default |
| Rounded corners on everything | Intentional radius — sharp, medium, or pill per component type |
| Generic shadow on every card | Intentional elevation: flat, subtle, or dramatic per context |
| Hero + features + CTA grid | Context-specific layout that matches the product's job |

If the design source (spec or Figma) already specifies these choices, carry them through faithfully. Do not re-introduce generic defaults during code generation.

## Step 4 — Four-pass verification (UI tasks only)

After generating the component:

1. **Type + lint** (`tsc --noEmit && npm run lint`) — structural correctness
2. **`/baseline-ui`** (Frontend Design command) — strip any AI-generic patterns that slipped through
3. **`/fixing-accessibility`** (Frontend Design command) — keyboard, ARIA, contrast, focus
4. **Playwright live test** (`sdlc-playwright`) — confirm the feature works in a real browser

Do not report the task done until all four passes are clean. A task that passes lint but fails `/fixing-accessibility` is not done.

## Red flags

| Thought | Reality |
|---|---|
| "It's a small component, I'll skip the design source" | All UI has a design source or generates one. No exceptions. |
| "I'll fix accessibility after" | Accessibility retrofitted after layout is 3× harder than designed-in. |
| "The brand colors are close enough" | Tokens are either exact or they break the design system. |
| "The motion looks fine" | `prefers-reduced-motion` is a legal requirement in EU contexts, not a preference. |
