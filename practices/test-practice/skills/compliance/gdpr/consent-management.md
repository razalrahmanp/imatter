---
id: consent-management
title: "GDPR consent management — collection, withdrawal, audit trail"
layer: compliance
compliance_module: gdpr
tags: [gdpr, consent, lawful-basis, withdrawal, audit, article-7, compliance]
applies_to:
  task_types: [add-endpoint, add-handler, add-form, add-component]
  stages: [3, 6, 10]
size_tokens: 220
related: [data-subject-rights, pii-handling, audit-logging]
---

# consent-management — GDPR Consent Pattern

## Pattern Summary

Consent must be freely given, specific, informed, and unambiguous. It must be as easy to withdraw as to give. Always log consent events as evidence.

**Consent record schema:**
```sql
CREATE TABLE consent_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid NOT NULL REFERENCES customers(id),
  purpose        text NOT NULL,          -- e.g. 'marketing_email', 'analytics', 'profiling'
  lawful_basis   text NOT NULL DEFAULT 'consent',  -- or 'legitimate_interest', 'contract', etc.
  granted        boolean NOT NULL,
  granted_at     timestamptz,
  withdrawn_at   timestamptz,
  ip_address     inet,                   -- store hashed or omit if not needed
  user_agent     text,
  consent_text   text NOT NULL,          -- exact wording shown to user at time of consent
  version        integer NOT NULL DEFAULT 1  -- increment when wording changes
);
```

**Recording consent:**
```typescript
async function recordConsent(
  db: PoolClient,
  customerId: string,
  purpose: string,
  granted: boolean,
  consentText: string,
  version: number
): Promise<void> {
  await db.query(
    `INSERT INTO consent_records
       (customer_id, purpose, lawful_basis, granted, granted_at, withdrawn_at, consent_text, version)
     VALUES ($1, $2, 'consent', $3, $4, $5, $6, $7)`,
    [
      customerId, purpose, granted,
      granted ? new Date().toISOString() : null,
      granted ? null : new Date().toISOString(),
      consentText, version
    ]
  );
}
```

**Valid consent UI requirements:**
- Checkbox must be unchecked by default — pre-ticked boxes are invalid
- Each purpose requires a separate checkbox (no bundled consent)
- Plain language — no legalese
- Withdrawal option must be equally prominent as the consent option

## Full Reference

### Lawful bases other than consent
- **Contract**: processing necessary to perform a contract with the user — no consent needed
- **Legitimate interest**: requires a three-part test (purpose, necessity, balancing) — document the LIA
- **Legal obligation**: law requires it — cite the specific law

### Consent withdrawal
When `withdrawn_at` is set: stop all processing for that purpose within 24 hours. Check `consent_records` before any marketing send, profiling job, or analytics pipeline run.

### Re-consent triggers
- Consent text changes materially → increment `version` → re-collect consent from existing users
- Purpose scope widens → new consent record required

### Forbidden
- Pre-ticked consent boxes
- Bundling unrelated purposes into a single checkbox
- Using consent as the lawful basis when the processing is actually necessary for a contract
- Continuing processing after withdrawal
