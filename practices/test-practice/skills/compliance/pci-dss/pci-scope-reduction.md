---
id: pci-scope-reduction
title: "PCI DSS scope reduction — isolate CDE, minimize in-scope systems"
layer: compliance
compliance_module: pci-dss
tags: [pci-dss, scope-reduction, cde, segmentation, tokenization, compliance]
applies_to:
  task_types: [add-integration, add-feature, add-worker]
  stages: [1, 2, 6, 10]
size_tokens: 200
related: [card-data-tokenization, pan-truncation, pci-network-segmentation]
---

# pci-scope-reduction — PCI DSS Scope Reduction

## Pattern Summary

Every system that touches PAN data is in scope for PCI DSS and must meet all requirements. The goal is to minimize in-scope systems. Each reduction tactic below shrinks your audit surface.

**Scope reduction tactics (in order of impact):**

```
1. TOKENIZE AT ENTRY POINT (highest impact)
   → Card data tokenized by Razorpay SDK before reaching your servers
   → Result: your servers are out of CDE scope for PAN processing

2. NETWORK SEGMENTATION
   → Isolate any remaining CDE systems in a separate network segment
   → No direct connectivity from out-of-scope systems to CDE
   → See: pci-network-segmentation skill

3. REDUCE DATA RETENTION
   → Delete card data as soon as it's no longer needed
   → If you must retain: only last4 + brand (not a PAN — not in scope)

4. MINIMIZE SYSTEM CONNECTIVITY
   → Only systems with a documented need connect to CDE
   → Each connection requires a firewall rule with stated business justification

5. USE HOSTED PAYMENT PAGE
   → Redirect to Razorpay-hosted payment page for checkout
   → Your server never sees the POST with card data at all
   → Reduces scope to SAQ A (simplest assessment level)
```

**PCI SAQ selection (Self-Assessment Questionnaire):**
```
SAQ A:   Card-not-present, fully outsourced to validated processor, hosted payment page only
         → Fewest requirements (~22 controls)

SAQ A-EP: Your JavaScript on payment page but Razorpay JS handles card fields (iFrame)
           → More requirements than A, less than D

SAQ D:   Any other card-present or mixed scenarios — full 300+ control assessment
```

## Full Reference

### Scope documentation
Maintain a CDE diagram showing: in-scope systems, network boundaries, data flows, segmentation controls. Auditors require this at assessment time.

### Annual scope review
At least annually (and after any significant change): re-verify scope. New integrations, cloud services, or architecture changes can silently expand scope.

### Forbidden
- Adding a new integration that touches payment flows without re-assessing PCI scope
- Assuming "we use Razorpay so we're out of scope" — your JS, webhooks, and server-side capture handlers are still reviewed
- Allowing out-of-scope systems to reach in-scope systems without a firewall rule with documented justification
