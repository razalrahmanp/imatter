---
id: accessibility-eu
title: "EU Accessibility Act — gate criteria for products sold in the EU"
layer: compliance
compliance_module: accessibility-eu
tags: [eu-accessibility-act, wcag, compliance, eaa, en-301-549, legal]
applies_to:
  task_types: [audit, compliance-check]
  stages: [8]
size_tokens: 240
related: [wcag-2-1-aa, accessibility-us, accessibility-wcag]
---

# accessibility-eu — EU Accessibility Act Compliance Module

## Pattern Summary

Any product sold in the EU with a browser UI must meet WCAG 2.1 Level AA (EN 301 549) by 28 June 2025. Publish an accessibility statement at `/accessibility`, provide a user feedback mechanism, and ensure product documentation is itself WCAG AA compliant. Micro-enterprises (< 10 employees AND < €2M turnover) are exempt.

**Stage 8 gate additions when this module is active:**
```
□ wcag-2-1-aa compliance module gate PASSED
□ /accessibility statement live and meets minimum content requirements
□ Feedback mechanism (email or form) confirmed functional
□ Product documentation audited — Lighthouse a11y ≥ 90 for 3+ doc pages
```

## Who this applies to

Any product or service with a browser-facing UI that is:
- Sold or made available to consumers in the European Union
- Operated by an entity with > 10 employees OR > €2M turnover
- Released or substantially updated after 28 June 2025

**Enforcement start:** 28 June 2025. Member states may levy fines and require product withdrawal.

## Technical standard

The EU Accessibility Act (EAA / EN 301 549) references **WCAG 2.1 Level AA** as the required technical standard. Passing `wcag-2-1-aa` compliance module is a prerequisite for this module.

## Additional EAA requirements beyond WCAG

| Requirement | How to satisfy |
|---|---|
| Accessibility statement published | Public-facing page at `/accessibility` describing compliance level, known gaps, contact for issues |
| Feedback mechanism | Contact email or form for users to report accessibility barriers |
| Product documentation accessible | User guides and help docs must themselves be WCAG AA compliant |
| Support services accessible | If you have a support chat or phone line, it must be accessible to deaf/hard-of-hearing users |

## Stage 8 gate additions

When this module is active, Stage 8 requires:

| Criterion | Evidence required |
|---|---|
| WCAG 2.1 AA gate passed | `wcag-2-1-aa` compliance module PASSED |
| Accessibility statement published | URL of `/accessibility` page confirmed live |
| Feedback mechanism in place | Email or form confirmed functional |
| Product docs audited | Lighthouse a11y score ≥ 90 for at least 3 doc pages |

**Accessibility statement minimum content:**
```markdown
## Accessibility statement

<Product name> aims to meet WCAG 2.1 Level AA.

**Current status:** Partially conformant / Fully conformant (update as accurate)

**Known exceptions:**
- (list any accepted deviations with justification)

**Feedback:** Report accessibility issues at <email> or <form URL>.

**Enforcement:** If you are not satisfied with our response, contact your national enforcement body.

Last reviewed: <date>
```

## Exemptions

- Micro-enterprises (< 10 employees AND < €2M turnover) — exempt from EAA
- Products in service before June 2025 — 10-year grace period for substantial changes
- Third-party content not under product's control — not covered, but link to it from the statement

## Verification

```bash
# Confirm accessibility statement is live
curl -s https://<domain>/accessibility | grep -i "wcag"

# Audit the accessibility page itself
npx lighthouse https://<domain>/accessibility --only-categories=accessibility
```
