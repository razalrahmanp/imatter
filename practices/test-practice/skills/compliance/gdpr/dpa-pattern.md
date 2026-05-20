---
id: dpa-pattern
title: "GDPR DPA pattern — controller/processor contracts, Article 28 clauses"
layer: compliance
compliance_module: gdpr
tags: [gdpr, dpa, processor, controller, article-28, compliance]
applies_to:
  task_types: [add-integration, add-vendor, add-worker]
  stages: [2, 6, 10]
size_tokens: 215
related: [data-subject-rights, cross-border-transfer, audit-logging]
---

# dpa-pattern — Data Processing Agreement Pattern

## Pattern Summary

Every third-party processor that touches personal data must have a signed DPA in place before data flows to them. No DPA = no data transfer.

**Article 28 mandatory clauses — your DPA must include all of these:**
```
1. Process data only on documented controller instructions
2. Confidentiality obligations on all personnel with access
3. Implement Art. 32 security measures (encryption, pseudonymisation, access control)
4. No sub-processor engagement without prior written controller consent
5. Assist controller with data subject rights requests (Art. 15–22)
6. Delete or return all data after service end
7. Provide audit rights / evidence of compliance
8. Notify controller of any personal data breach without undue delay
```

**DPA registry — track all processors:**
```typescript
interface DpaRecord {
  vendor_name:    string;
  vendor_email:   string;
  signed_at:      string;   // ISO date
  expires_at:     string | null;
  data_categories: string[]; // e.g. ["customer_email", "order_history"]
  processing_purposes: string[];
  sub_processors: string[];  // vendors the processor is allowed to use
  dpa_document_url: string;  // S3 / Drive link — not public
}
```

**Sub-processor change notification:**
When a processor adds a new sub-processor, they must notify you. You have the right to object within a reasonable period (typically 30 days). Log objections and outcomes.

## Full Reference

### Processor vs controller
- **Controller**: decides WHY and HOW data is processed. You are the controller.
- **Processor**: acts on controller instructions only. AWS, Stripe, SendGrid, etc. are processors.
- If a vendor uses your data for their own purposes, they become a joint controller — different contract required.

### Annual DPA review
Schedule annual DPA review for each vendor. Validate: data categories still accurate, sub-processor list current, contact details valid.

### Forbidden
- Sending personal data to a new vendor without a signed DPA on file
- Allowing processors to use customer data for their own analytics/training
- Accepting verbal instructions as "documented controller instructions"
