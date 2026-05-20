---
name: sdlc-design-drift-audit
description: Use periodically to verify that the live product UI still matches the design source of truth (Figma + design spec) — covers what to check and how to surface drift.
---

## Rule

Over time, code drifts from design. Engineers add buttons not in Figma; designers update Figma without engineering catching up. A drift audit periodically compares production UI to the source of truth and surfaces gaps. Without it, the design system rots.

## What to audit

| Layer | Compare |
|---|---|
| **Components** | Production component vs Figma component vs spec ([[sdlc-design-spec-jsonc]]) |
| **Tokens** | Hardcoded colors / spacings in code vs the token system |
| **Typography** | Font scale used in code vs designed scale |
| **Brand consistency** | Buttons / cards / inputs styled identically across pages |
| **Iconography** | Icons used vs icon system |
| **Spacing / layout** | Padding / gap values vs the spacing scale |

## Pattern — cadence

| Frequency | Depth |
|---|---|
| Weekly | Automated: lint for hex colors / magic spacing outside tokens |
| Monthly | Designer + engineer pair walks through new flows; documents drift |
| Quarterly | Full audit of one product area; remediation backlog |
| Annually | Full design-system health review |

## Automated checks

```bash
# Find non-token colors in component CSS
grep -rE "#[0-9a-fA-F]{3,6}" --include="*.{css,tsx,vue}" src/ \
  | grep -v "tokens.css" \
  | grep -v "@allow-hex"
```

```bash
# Find non-scale spacings
grep -rE "(margin|padding|gap):\s*[0-9]+(\.[0-9]+)?(px|rem)" --include="*.css" src/ \
  | grep -vE "(0|4|8|12|16|20|24|32|40|48)" 
```

These false-positive a lot; treat as a starting list, not a verdict.

## Pattern — Figma export comparison

If your design system has Figma components, export their tokens / properties periodically:

```
Figma tokens (via plugin like Tokens Studio) → JSON
Compare against code tokens.json
```

Mismatches mean either the Figma update didn't ship, or the code went off-system.

## Pattern — visual regression

```
For each design-system component:
  Render in Storybook
  Take screenshot per variant
  Compare to last release's screenshots
  Diff visible → review
```

See [[sdlc-visual-regression-pattern]].

This catches:
- Unintended visual changes
- Stylistic drift over time
- Cross-component inconsistency

## Drift backlog

Findings go into a drift backlog (could be a separate tracker, or a label on issues):

```
Drift: "New Promotional Banner" component
  Pages affected: /home, /promo
  Drift type: New color outside palette (#FF6B6B not in tokens)
  Impact: 2 pages
  Fix: Add token color.promotional.coral OR redesign to use existing token
  Owner: design + engineering
```

## How drift accumulates

Common sources:
- One-off feature ("just this once") gets repeated
- Marketing requests "special" treatment for a campaign
- Vendor / SDK widgets brought in with their own styling
- Old code that predates the design system
- Acquired team's design that wasn't unified

Each source needs a remediation strategy:
- Marketing one-offs: tokens for "campaign" variants or live with it
- Vendor widgets: theme overrides
- Pre-system code: migration project on schedule

## Anti-patterns

- ❌ "Audit" that's a vibes check (no specific criteria)
- ❌ Drift backlog without owners or priorities
- ❌ Audit catches drift but no one fixes it (drift accumulates)
- ❌ Designer-only audit (engineers blamed for "drift" they didn't introduce)
- ❌ Engineer-only audit (purely technical, no design judgement)
- ❌ Drift counted as severity-0 forever ("we'll get to it")
- ❌ No automated checks; every audit is fully manual
- ❌ Audit findings stored in Slack messages (lost)

## Cross-references

- [[sdlc-design-system-tokens]] — what's being drifted from
- [[sdlc-design-spec-jsonc]] — what components should match
- [[sdlc-visual-regression-pattern]] — automated visual diffs
- [[sdlc-tech-debt-tracking]] — drift can be tracked as debt

## Gate criteria

- Automated lints catch new hex colors / magic spacing outside tokens
- Monthly review walks through new flows; logs drift
- Quarterly full audit of one product area
- Drift backlog exists with owners and priorities
- Visual regression catches unintended changes per PR
- Token coverage measured: % of styled values referencing tokens vs literals
