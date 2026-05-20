---
name: sdlc-hipaa-phi-handling
description: Use when building or auditing a system that handles Protected Health Information (PHI) under US HIPAA — covers what counts as PHI, encryption, access controls, and BAA requirements.
---

## Rule

HIPAA-covered systems must protect PHI (Protected Health Information) via the Security Rule's administrative, physical, and technical safeguards. Encryption is mandatory at rest and in transit. Access is role-based and audited. Business Associate Agreements (BAAs) are signed with every vendor that touches PHI.

## What counts as PHI

Individually identifiable health information held by a covered entity. Includes:

| Identifier type | Examples |
|---|---|
| Names | Patient names; relatives' names |
| Geographic data | Smaller than state (full address, ZIP — first 3 digits OK in some cases) |
| Dates | Birth date, admission, discharge, death (year alone OK in some cases) |
| Phone, fax | All |
| Email addresses | All |
| SSN | All |
| Medical record numbers | All |
| Health plan numbers | All |
| Account numbers | All |
| Certificate / license numbers | All |
| Vehicle identifiers | License plates, VINs |
| Device identifiers | Implant serial numbers |
| URLs | If they identify the patient |
| IP addresses | All |
| Biometric identifiers | Fingerprints, voice prints |
| Photographs | Full face, identifying features |
| Any other unique identifier | Catch-all |

The 18 HIPAA identifiers. PHI = any health-related data + any of these. De-identification means stripping ALL of them (or expert determination with statistical method).

## Encryption — addressable but effectively required

HIPAA Security Rule lists encryption as "addressable" — but in practice it's required because the only alternative is documenting an equivalent measure, which is harder than just encrypting.

| Surface | Encryption |
|---|---|
| At rest in DB | TDE or column-level (BYOK is best — see [[sdlc-secret-handling]]) |
| At rest in object storage | SSE-KMS with customer-managed keys |
| In transit | TLS 1.2+ everywhere; HSTS |
| Backups | Same as primary, separate keys |
| Mobile devices | Full-disk encryption mandatory |
| Email | TLS minimum; consider end-to-end (S/MIME, dedicated secure email) |

## Access controls

| Requirement | Implementation |
|---|---|
| **Unique user IDs** | One account per person (no shared "doctor" account) |
| **Role-based access** | Roles tied to job function; minimum necessary access |
| **Automatic logoff** | Session timeout after inactivity (~10–15 min) |
| **Audit controls** | Log every PHI access (who, what, when, from where) |
| **Authentication** | Strong (MFA for clinical/admin roles minimum) |
| **Emergency access** | Break-glass procedure with full audit |

The "minimum necessary" rule (Privacy Rule) applies operationally — even within a role, only access the records you need for the immediate task.

## Audit logging — explicit requirement

```ts
auditLog.write({
  actor_id: user.id,
  actor_role: user.role,
  action: "phi.access",
  resource_type: "patient_record",
  resource_id: patientId,
  fields_accessed: ["dob", "diagnosis", "treatment_plan"],
  reason: "appointment_review",  // documented reason
  ip: req.ip,
  timestamp: new Date(),
});
```

Retain audit logs at least 6 years (HIPAA retention).

See [[sdlc-audit-logging]] for the general pattern.

## BAA — Business Associate Agreement

Anyone who touches PHI on your behalf (not as a covered entity themselves) must have a BAA signed with you:

- Cloud hosts (AWS, GCP, Azure all offer BAA tiers)
- SaaS tools that process PHI
- Contractors / consultants
- Subcontractors of the above (chain of BAAs)

Verify BAA coverage before any PHI flows. Many cloud services are NOT BAA-eligible (e.g. specific AWS services excluded from the BAA — check the list).

## Breach notification — strict timeline

| Threshold | Timeline |
|---|---|
| Breach affecting ≥ 500 individuals | Notify HHS + affected individuals within 60 days; notify media |
| Breach affecting < 500 individuals | Annual log to HHS; affected individuals notified |
| Business associate discovers breach | Notify covered entity within 60 days |

A "breach" includes: unauthorized access, even if no one looked; lost laptop with PHI even if encrypted (depending on circumstances); ransomware (presumption of breach unless you can demonstrate low probability of PHI compromise).

See [[sdlc-hipaa-breach-notification]] for the full procedure.

## De-identification — Safe Harbor + Expert Determination

To use PHI without HIPAA constraints (e.g. for research, analytics):

**Safe Harbor**: Remove all 18 identifiers above. Don't re-identify.

**Expert Determination**: A qualified statistician certifies the data carries "very small" re-identification risk. More flexible but requires expertise.

Don't claim "anonymized" data is exempt without one of these methods.

## Anti-patterns

- ❌ PHI in development / staging databases (use synthetic data)
- ❌ Shared accounts (can't audit who did what)
- ❌ PHI in logs / error reports
- ❌ Cloud services used for PHI without BAA coverage
- ❌ Sub-processors not under BAA (chain breaks)
- ❌ Encryption with shared / static keys
- ❌ Long session lifetimes for clinical staff
- ❌ No "minimum necessary" check (everyone-can-see-everything model)
- ❌ Email of PHI on non-TLS-required systems
- ❌ Backups outside BAA-covered storage

## Cross-references

- [[sdlc-pii-handling]] — generic PII; PHI is a stricter category
- [[sdlc-hipaa-phi-access-logging]] — detail on the access log
- [[sdlc-hipaa-baa-pattern]] — BAA specifics
- [[sdlc-hipaa-breach-notification]] — breach response

## Gate criteria

- A list of every system / service that touches PHI is maintained
- BAAs are signed and on file with every vendor on that list
- PHI encrypted at rest with customer-managed keys
- All PHI access logged; logs retained 6+ years
- Unique user IDs; no shared accounts for PHI access
- MFA required for clinical and admin access
- Session timeout configured (~10–15 min)
- Synthetic data used in dev / staging; PHI never in non-prod
- Breach response runbook exists with the 60-day timeline
- Annual HIPAA risk assessment performed and documented
