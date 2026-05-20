---
name: sdlc-hipaa-phi-access-logging
description: Use when designing access logging for HIPAA-covered systems — covers what to log, retention, where the log lives, and the queries needed for the standard HIPAA accountings.
---

## Rule

Every access to PHI is logged. The log captures who accessed what, when, and (often) why. Retention is at least 6 years. The log is tamper-resistant and used to fulfill HIPAA "accounting of disclosures" requests from patients.

## What to log

| Field | Required |
|---|---|
| `actor_id` | User who accessed |
| `actor_role` | Their role at time of access (roles change; record at the time) |
| `action` | view, create, update, delete, export, print, share |
| `resource_type` | patient_record, encounter, lab_result, imaging, billing |
| `resource_id` | Patient or record ID |
| `fields_accessed` | If granular (e.g. only viewed DOB and diagnosis, not full record) |
| `reason` | Documented justification: 'appointment', 'lab_review', 'patient_request', 'qa_review' |
| `ip` | Source IP |
| `user_agent` | Client info |
| `session_id` | Correlate with other actions in the same session |
| `ts` | Server clock, not user clock |
| `request_id` | Correlate with application logs |

## Pattern

```ts
// Wrap every PHI-touching query
async function getPatientRecord(actor: User, patientId: string, reason: string) {
  const record = await db.patient_records.findById(patientId);
  if (!record) return null;

  await auditLog.write({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "patient_record.view",
    resource_type: "patient_record",
    resource_id: patientId,
    fields_accessed: Object.keys(record),
    reason,
    ip: actor.ip,
    session_id: actor.session_id,
    ts: new Date(),
  });

  return record;
}
```

The "reason" field is debatable — some implementations require explicit reason on every access; others infer it from the workflow context. The stricter pattern (require explicit reason for non-routine access) deters snooping.

## Storage

| Property | Why |
|---|---|
| Append-only | Tamper resistance — log row cannot be modified |
| Separate from application DB | Different access patterns; different retention |
| 6+ year retention | HIPAA Privacy Rule §164.530(j) |
| Restricted read access | Reading the audit log is itself audit-worthy |
| Time-stamped reliably | Server clock; never user-supplied |

Implementation options:
- Separate `audit_log` DB schema with revoked UPDATE/DELETE for app role
- AWS CloudTrail-style append-only log (Loki / S3 + Object Lock for very long retention)
- Specialized: Splunk, Datadog Audit Trail, Cribl

## Accounting of disclosures — what patients can request

Under HIPAA, patients can request a list of disclosures of their PHI in the past 6 years (with some exceptions for treatment/payment/operations).

Build a query that returns this:

```sql
SELECT 
  ts AS disclosed_at,
  actor_role,
  action,
  reason,
  recipient    -- where the data went (for disclosures, not just access)
FROM audit_log
WHERE resource_type = 'patient_record'
  AND resource_id = $1
  AND action IN ('disclosed', 'exported', 'shared', 'faxed')
  AND ts > now() - interval '6 years'
ORDER BY ts DESC;
```

Treatment/payment/operations (TPO) accesses are typically excluded from the accounting, but you must still log them — the exclusion is for the *patient-facing report*, not the log itself.

## Snooping detection

A common HIPAA violation is staff looking at records they shouldn't (celebrities, family, neighbors). Detect:

- High volume of accesses by one actor in a short window
- Accesses outside the actor's department / role scope
- Same name match between actor and resource (potential family lookup)
- Access patterns inconsistent with workflow (e.g. nurse looking at records with no appointment scheduled)

Run as a scheduled job. Surface high-risk patterns for security review.

## Anti-patterns

- ❌ Application logs ≠ audit log (granularity, retention, access control all different)
- ❌ Logging "user viewed PHI" without resource_id (useless for accounting)
- ❌ Mutable log (app role has UPDATE permission)
- ❌ Logs deleted with the user data they reference (audit log is exempt from erasure)
- ❌ Logging the actual PHI in the log (don't log the diagnosis; log that the actor viewed the field)
- ❌ Free-form "action" field that's not queryable
- ❌ No retention policy — logs grow unbounded or get auto-purged early
- ❌ No snooping-detection job

## Cross-references

- [[sdlc-audit-logging]] — generic audit pattern; PHI logging is a stricter version
- [[sdlc-hipaa-phi-handling]] — broader HIPAA requirements
- [[sdlc-data-retention]] — different retention for audit logs vs application data

## Gate criteria

- Every code path that reads or modifies PHI writes an audit log entry
- The audit log table has revoked UPDATE/DELETE for the application role
- Retention configured for ≥ 6 years
- A query exists that produces the patient's "accounting of disclosures" report
- A snooping-detection job runs at least daily; alerts on patterns
- An onboarding test exists that creates a record, accesses it, and verifies the log entry
- Reading the audit log is itself logged
