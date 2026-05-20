---
id: data-subject-rights
title: "GDPR data subject rights — access, erasure, portability, rectification"
layer: compliance
compliance_module: gdpr
tags: [gdpr, privacy, data-subject, erasure, portability, compliance]
applies_to:
  task_types: [add-endpoint, add-handler, modify-handler]
  stages: [6, 10]
size_tokens: 220
related: [pii-handling, audit-logging, data-retention]
---

# data-subject-rights — GDPR Data Subject Rights Pattern

## Pattern Summary

Every GDPR right must be serviced within the statutory deadline and logged as evidence.

```
Right of Access (Art. 15)        — 30 days to respond; provide all personal data held
Right to Erasure (Art. 17)       — 30 days; delete or anonymise; log completion as evidence
Right to Portability (Art. 20)   — 30 days; machine-readable export (JSON or CSV)
Right to Rectification (Art. 16) — 30 days; correct inaccurate data; log before/after
```

**Erasure pattern:**
```typescript
async function eraseDataSubject(customerId: string, branchId: string): Promise<ErasureReceipt> {
  return withRls(branchId, async (db) => {
    await db.query("BEGIN");
    // Anonymise — do not hard-delete rows that break foreign key chains
    await db.query(
      "UPDATE customers SET email = $2, phone = $3, name = $4 WHERE id = $1",
      [customerId, `erased-${customerId}@erased.invalid`, "ERASED", "ERASED"]
    );
    // Hard-delete rows with no FK dependencies
    await db.query("DELETE FROM customer_sessions WHERE customer_id = $1", [customerId]);
    await db.query("COMMIT");
    // Log erasure as evidence — the receipt is your compliance proof
    const receipt = { customerId, erasedAt: new Date().toISOString(), requestId: crypto.randomUUID() };
    await db.query("INSERT INTO gdpr_erasure_log VALUES ($1, $2, $3)", [receipt.customerId, receipt.erasedAt, receipt.requestId]);
    return receipt;
  });
}
```

**Never fully delete customers with existing orders** — anonymise the PII fields, preserve the row for financial record integrity.

## Full Reference

### Deadline tracking
Store DSR requests in `data_subject_requests` table with `received_at`, `type`, `status`, `deadline_at` (received_at + 30 days). Alert when `deadline_at - NOW() < 5 days` and `status != "completed"`.

### Portability export format
JSON array of the subject's data across all tables. Include: profile, orders (anonymised to amounts + dates), preferences. Exclude: internal IDs used for other tenants.

### Forbidden
- Hard-deleting customers with financial records (audit trail obligation under Art. 17(3)(b))
- Erasure without logging the receipt
- Responding after 30 days without extension notice to the data subject
