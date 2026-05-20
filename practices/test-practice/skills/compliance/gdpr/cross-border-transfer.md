---
id: cross-border-transfer
title: "GDPR cross-border transfer — SCCs, adequacy decisions, transfer impact assessment"
layer: compliance
compliance_module: gdpr
tags: [gdpr, cross-border, sccs, adequacy, chapter-v, compliance]
applies_to:
  task_types: [add-integration, add-vendor, add-worker]
  stages: [2, 6, 10]
size_tokens: 210
related: [dpa-pattern, data-subject-rights]
---

# cross-border-transfer — Cross-Border Transfer Mechanisms

## Pattern Summary

Transferring personal data outside the EEA requires a lawful transfer mechanism. Pick one and document it before data leaves.

**Transfer mechanism decision tree:**
```
Is destination country on EU adequacy list?
  → YES: transfer allowed. Cite the adequacy decision in your transfer record.
         Adequacy countries (2024): UK, Switzerland, Japan, South Korea, NZ, Canada (commercial), Israel, ...

  → NO: Use Standard Contractual Clauses (SCCs) — June 2021 edition (old 2010 SCCs invalid)
         Module to use:
           Controller → Processor:  Module 2
           Controller → Controller: Module 1
           Processor → Processor:   Module 3
           Processor → Controller:  Module 4

  → Large org / binding rules: Binding Corporate Rules (BCRs) — needs DPA approval, months to obtain
```

**SCC implementation checklist:**
```
□ Execute SCCs before first data transfer (not retroactively)
□ Complete Transfer Impact Assessment (TIA) if destination country has broad surveillance laws (e.g. US)
□ Document supplementary measures if TIA shows transfer risk:
    - Encryption in transit and at rest (key held in EEA)
    - Pseudonymisation before transfer
    - Contractual restrictions on government access disclosure
□ Attach SCCs to the DPA as an annex
□ Record transfer in Article 30 processing record
```

**Article 30 transfer record entry:**
```typescript
interface TransferRecord {
  recipient_country: string;        // ISO 3166-1 alpha-2
  recipient_name:    string;
  transfer_mechanism: "adequacy" | "scc" | "bcr" | "derogation";
  scc_module?:       "1" | "2" | "3" | "4";
  tia_completed_at?: string;
  supplementary_measures?: string[];
  data_categories:   string[];
}
```

## Full Reference

### TIA risk indicators
High-risk destinations (require TIA): US, India, China, UAE, Brazil, Russia. Check local surveillance law scope — does it compel disclosure without notification to data subject?

### Derogations (Art. 49) — use sparingly
Explicit consent, performance of a contract, public interest, vital interests. Not a substitute for SCCs for routine transfers.

### Forbidden
- Transferring EEA personal data to a non-adequate country without SCCs or BCRs
- Using the 2010 SCC templates (invalid since Dec 2022)
- Treating a US vendor as adequate without SCCs just because they're Privacy Shield certified (Privacy Shield invalidated Jul 2020)
