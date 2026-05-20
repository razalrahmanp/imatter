---
id: pan-truncation
title: "PCI DSS PAN truncation — display rules, masking, storage limits"
layer: compliance
compliance_module: pci-dss
tags: [pci-dss, pan, truncation, masking, display, compliance]
applies_to:
  task_types: [add-component, add-handler, add-endpoint]
  stages: [3, 5, 6]
size_tokens: 195
related: [card-data-tokenization, pci-scope-reduction]
---

# pan-truncation — PCI DSS PAN Truncation Rules

## Pattern Summary

When displaying or logging card numbers, use truncation and masking. PCI DSS 4.0 requires that at most the first 6 and last 4 digits are displayed — the combination of BIN (first 6) + last 4 is the absolute maximum.

**Allowed display formats:**
```
Full PAN:    4111 1111 1111 1234   ← NEVER display or log this
6 + 4:       411111 ****** 1234   ← maximum allowed (exceptional cases only)
Last 4 only: **** **** **** 1234  ← standard — use this in most UIs
BIN only:    411111 ***** ****    ← for analytics/routing — no last 4
```

**Masking utility:**
```typescript
function maskPan(pan: string): string {
  // Returns last 4 only: **** **** **** 1234
  const digits = pan.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  const last4 = digits.slice(-4);
  const maskedGroups = "*".repeat(digits.length - 4).replace(/(.{4})/g, "$1 ").trim();
  return `${maskedGroups} ${last4}`;
}

// For display — use last4 stored in DB, never reconstruct from full PAN
function displayCard(last4: string, brand: string): string {
  return `${brand} ending in ${last4}`;
}
```

**Logging rules:**
```typescript
// CORRECT — log last4 only from stored field, never the full PAN
logger.info("payment_processed", { payment_id, last4: payment.last4, amount });

// FORBIDDEN — never log raw PAN even briefly
logger.info("payment_debug", { card_number: rawPan }); // triggers PCI incident
```

## Full Reference

### PCI DSS 4.0 change (effective March 2025)
PCI DSS 4.0 clarified: displaying first 6 + last 4 together requires documented business justification. Default to last 4 only unless there is a specific need for BIN display (e.g. routing decisions — and even then, never combine with last 4 in display).

### Receipt and confirmation emails
Show only last 4 and card brand. Do not show expiry in email — it adds no user value and widens scope.

### Analytics and reporting
Use `card_brand` and `last4` fields only. Exclude last 4 from any public or shareable reports — internal use only.

### Forbidden
- Logging or displaying more than last 4 digits in any UI, log, or report
- Combining first 6 + last 4 in any user-facing display without explicit business justification
- Storing full PAN in any application database, log file, or cache
