---
id: accessibility-us
title: "ADA Title III — gate criteria for US consumer-facing web products"
layer: compliance
compliance_module: accessibility-us
tags: [ada, title-iii, wcag, compliance, accessibility, us, legal]
applies_to:
  task_types: [audit, compliance-check]
  stages: [8]
size_tokens: 230
related: [wcag-2-1-aa, accessibility-eu, accessibility-wcag]
---

# accessibility-us — ADA Title III Accessibility Compliance Module

## Pattern Summary

US consumer-facing web products must meet WCAG 2.1 Level AA under ADA Title III (established by case law). No formal registration — compliance is demonstrated by WCAG conformance and documented remediation. Proactive compliance is cheaper than litigation; demand letters arrive without prior notice.

**Stage 8 gate additions when this module is active:**
```
□ wcag-2-1-aa compliance module gate PASSED
□ Accessibility statement or VPAT published
□ Feedback/remediation contact confirmed functional
□ No known critical (Level A) violations in production
```

## Who this applies to

Any web product that is:
- Accessible to US consumers (public-facing URL reachable from the US)
- Operated by a "place of public accommodation" — courts have consistently held websites qualify
- Operated by any company with US operations, US customers, or US-incorporated entity

**Risk level:** ADA Title III lawsuits have been rising since 2020 and reached all-time highs in 2024–2025. Demand letters and serial plaintiffs target companies with no accessibility statement.

## Technical standard

The DOJ (Department of Justice) issued a final rule in 2024 adopting **WCAG 2.1 Level AA** as the accessibility standard for state/local government websites. Courts apply the same standard to private businesses under Title III. Passing `wcag-2-1-aa` compliance module is a prerequisite for this module.

## Stage 8 gate additions

When this module is active, Stage 8 requires:

| Criterion | Evidence required |
|---|---|
| WCAG 2.1 AA gate passed | `wcag-2-1-aa` compliance module PASSED |
| Accessibility policy published | Public-facing page or statement confirming commitment to accessibility |
| Remediation process documented | Internal runbook: what happens when an accessibility barrier is reported |
| Demand letter response plan | Legal has been briefed; templated response exists |

**Minimum accessibility policy content:**
```markdown
## Accessibility

<Product name> is committed to making our website accessible to people with disabilities.

We aim to meet WCAG 2.1 Level AA.

If you experience difficulty accessing any part of our site, contact us at <email>.
We aim to respond within 2 business days.

If you need an alternative format or have other accessibility needs, please contact us.
```

## Risk mitigation checklist

High-priority items that reduce lawsuit risk specifically (beyond WCAG compliance):

- [ ] Accessibility policy live and indexable (not hidden in terms of service)
- [ ] Contact mechanism functional — emails sent to accessibility contact are monitored
- [ ] All images have alt text (most common plaintiff complaint)
- [ ] All form inputs are labelled (second most common)
- [ ] PDF documents have accessible versions or HTML alternatives
- [ ] Videos have captions

## Key difference from EU module

| Aspect | ADA Title III (US) | EU Accessibility Act |
|---|---|---|
| Standard | WCAG 2.1 AA (courts) | WCAG 2.1 AA (regulation) |
| Enforcement | Private lawsuits | National enforcement bodies |
| Exemption | Small businesses < 15 employees have reduced obligations | < 10 employees / < €2M |
| Accessibility statement | Best practice, not required | Required |
| Grace period | None for new products | Until 2035 for pre-2025 products |
