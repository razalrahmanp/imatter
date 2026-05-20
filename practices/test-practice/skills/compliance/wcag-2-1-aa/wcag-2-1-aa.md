---
id: wcag-2-1-aa
title: "WCAG 2.1 AA — gate criteria for web accessibility compliance"
layer: compliance
compliance_module: wcag-2-1-aa
tags: [wcag, accessibility, compliance, a11y, stage-4, stage-8]
applies_to:
  task_types: [audit, compliance-check]
  stages: [4, 8]
size_tokens: 280
related: [accessibility-wcag, accessibility-eu, accessibility-us, motion-preference]
---

# wcag-2-1-aa — WCAG 2.1 Level AA Compliance Module

## Pattern Summary

WCAG 2.1 Level AA is the technical standard for web accessibility, referenced by EAA, ADA Title III, AODA, and UK Equality Act. Four principles: Perceivable, Operable, Understandable, Robust (POUR). Adds gate criteria to Stages 4 (testing) and 8 (pre-launch).

**Minimum passing bar:**
```
□ Lighthouse accessibility score ≥ 90 on all key pages
□ No keyboard trap — every interactive element reachable and operable via keyboard
□ All images have meaningful alt text (or alt="" for decorative images)
□ Colour contrast ≥ 4.5:1 for normal text, ≥ 3:1 for large text
□ Form inputs have programmatic labels (not placeholder-only)
□ Focus indicators visible at all times
□ Error messages identify the field and describe how to fix
```

## Scope

This compliance module adds WCAG 2.1 Level AA gate criteria to Stages 4 and 8 for any project with a browser-facing UI. It is the technical standard referenced by EU Accessibility Act (EN 301 549), ADA Title III, AODA (Canada), and DDA/Equality Act (UK/Australia).

## Stage 4 gate additions (Testing Strategy)

When this module is active, Stage 4 requires:

| Criterion | Evidence required |
|---|---|
| Automated accessibility scan passes | `axe-core` or Lighthouse accessibility score ≥ 90, zero critical violations |
| All interactive elements keyboard-navigable | Manual Tab walkthrough documented |
| All form inputs labelled | `axe --rules=label` zero violations |
| Reduced motion respected | `motion-preference` skill applied; tested with DevTools emulation |
| Visual regression tests capture focus states | Snapshot tests include focused variants for key components |

**Gate evidence format:**
```
WCAG 2.1 AA — Stage 4 evidence
Date: 2026-05-20
Tool: axe-core 4.x + Lighthouse 12.x
Score: Lighthouse accessibility 97/100
Critical violations: 0
Notable: 2 warnings (colour contrast on muted text — acknowledged, ratio 4.8:1 > 4.5:1 threshold)
Tester: <session>
```

## Stage 8 gate additions (Security)

| Criterion | Evidence required |
|---|---|
| Colour contrast meets 4.5:1 for body text | Lighthouse report + manual spot-check on muted tokens |
| Focus management correct on all modals/dialogs | Manual test per Radix Dialog — focus enters on open, returns on close |
| No ARIA misuse | Zero `aria-hidden` on interactive elements; zero `tabindex > 0` |
| Screen reader smoke test | VoiceOver / NVDA walkthrough of at least one critical user flow |
| No content flashes > 3 times/second | Visual review of all animations |

## Automated check commands

```bash
# Axe-core via Playwright
npx playwright test tests/a11y/ --reporter=html

# Lighthouse CLI
npx lighthouse http://localhost:3000 \
  --only-categories=accessibility \
  --output=json \
  --output-path=a11y-report.json

# Parse score
node -e "const r = require('./a11y-report.json'); console.log(r.categories.accessibility.score * 100)"
```

## Known acceptable deviations

Document here any criterion where a deliberate trade-off was made:

| Criterion | Deviation | Justification | Approved by |
|---|---|---|---|
| (none) | | | |

## Non-negotiable regardless of context

- `prefers-reduced-motion` must always be respected — no exceptions for "premium feel"
- Screen reader announcement of errors — never announce error-state by colour alone
- Keyboard access to every feature — no mouse-only paths in production
