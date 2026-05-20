---
id: phi-handling
title: "HIPAA PHI handling — 18 identifiers, safe harbor de-identification, minimum necessary"
layer: compliance
compliance_module: hipaa
tags: [hipaa, phi, de-identification, safe-harbor, minimum-necessary, compliance]
applies_to:
  task_types: [add-handler, add-endpoint, add-worker, add-integration]
  stages: [2, 3, 6, 10]
size_tokens: 215
related: [phi-access-logging, baa-pattern, breach-notification, pii-handling]
---

# phi-handling — HIPAA PHI Handling Pattern

## Pattern Summary

Protected Health Information (PHI) requires strict access controls, encryption, minimum-necessary access, and de-identification before any secondary use (analytics, ML training, export).

**The 18 PHI identifiers — any of these alone or in combination makes data PHI:**
```
1.  Names
2.  Geographic data smaller than state (street, city, zip)
3.  Dates (except year) related to individual — DOB, admission, discharge, death
4.  Phone numbers
5.  Fax numbers
6.  Email addresses
7.  SSN
8.  Medical record numbers
9.  Health plan beneficiary numbers
10. Account numbers
11. Certificate / license numbers
12. Vehicle identifiers (VIN, license plate)
13. Device identifiers and serial numbers
14. URLs
15. IP addresses
16. Biometric identifiers (fingerprints, voiceprints)
17. Full-face photographs
18. Any other unique identifying number, code, or characteristic
```

**Safe Harbor de-identification (45 CFR §164.514(b)) — remove all 18 identifiers AND:**
```typescript
function safeHarborDeidentify(record: PatientRecord): DeidentifiedRecord {
  return {
    // Remove all 18 identifiers
    // Dates: retain year only, not full date
    year_of_birth:    record.dob ? new Date(record.dob).getFullYear() : undefined,
    year_of_admission: record.admission_date ? new Date(record.admission_date).getFullYear() : undefined,
    // Geography: retain state only, not zip/city
    state:            record.state,
    // Generalize age ≥ 90 to "90+"
    age:              record.age >= 90 ? "90+" : String(record.age),
    // Safe to retain
    diagnosis_codes:  record.icd10_codes,
    procedure_codes:  record.cpt_codes,
    encounter_type:   record.encounter_type,
  };
}
```

**Minimum necessary rule:**
Request only the PHI fields required for the specific task. Never fetch full patient records for a workflow that only needs, say, the diagnosis code.

## Full Reference

### Encryption requirements
PHI at rest: AES-256. PHI in transit: TLS 1.2+ minimum (TLS 1.3 preferred). Keys must be separate from the data (no co-located key + ciphertext).

### Workforce access
Only workforce members with a need-to-know for their role may access PHI. Implement role-based access; log every access (see `phi-access-logging`).

### Forbidden
- Sending PHI in unencrypted email or chat
- Storing PHI in application logs, analytics events, or AI training datasets without de-identification
- Accessing PHI beyond the minimum necessary for the task
- Using zip codes as geographic identifiers in de-identified datasets (zip populations < 20,000 must be generalised)
