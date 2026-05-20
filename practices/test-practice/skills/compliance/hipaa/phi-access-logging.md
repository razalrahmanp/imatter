---
id: phi-access-logging
title: "HIPAA PHI access logging — 45 CFR §164.312(b) audit controls, 6-year retention"
layer: compliance
compliance_module: hipaa
tags: [hipaa, phi, audit-logging, access-log, 164312, compliance]
applies_to:
  task_types: [add-handler, add-endpoint, add-worker]
  stages: [5, 6, 7, 10]
size_tokens: 205
related: [phi-handling, baa-pattern, breach-notification, structured-logging]
---

# phi-access-logging — HIPAA PHI Access Logging (§164.312(b))

## Pattern Summary

Every access, modification, disclosure, or deletion of PHI must be logged. Logs must be retained for 6 years from creation or last use. Logs must not be modifiable after creation.

**PHI access log schema:**
```typescript
interface PhiAccessLog {
  log_id:        string;    // crypto.randomUUID()
  accessed_at:   string;    // ISO 8601
  actor_id:      string;    // workforce member user ID
  actor_role:    string;    // their role at time of access
  action:        "read" | "create" | "update" | "delete" | "disclose" | "export";
  resource_type: string;    // e.g. "patient_record" | "encounter" | "prescription"
  resource_id:   string;    // record identifier (not the PHI itself)
  phi_fields:    string[];  // which PHI fields were accessed, e.g. ["dob", "diagnosis"]
  purpose:       string;    // "treatment" | "payment" | "operations" | "research" | "legal"
  recipient?:    string;    // if disclosed: who received it (organization name)
  ip_address?:   string;    // optional — omit if not captured
  session_id:    string;
}
```

**Logging decorator for PHI endpoints:**
```typescript
async function withPhiLog<T>(
  actorId: string, actorRole: string, resourceType: string, resourceId: string,
  phiFields: string[], purpose: string, action: PhiAccessLog["action"],
  fn: () => Promise<T>
): Promise<T> {
  const result = await fn();
  // Log AFTER successful access — failed attempts are security events, logged separately
  await appendPhiLog({
    log_id: crypto.randomUUID(), accessed_at: new Date().toISOString(),
    actor_id: actorId, actor_role: actorRole, action,
    resource_type: resourceType, resource_id: resourceId,
    phi_fields: phiFields, purpose, session_id: getSessionId(),
  });
  return result;
}
```

## Full Reference

### 6-year retention
Store PHI access logs in an append-only store (S3 with Object Lock minimum 6-year retention, or a DB table with no DELETE permission granted to the application role).

### Disclosure accounting (§164.528)
Patients have a right to request an accounting of disclosures of their PHI to third parties. Maintain a queryable index: `resource_id`, `action = 'disclose'`, `recipient`, `accessed_at`. Must be producible within 60 days of patient request.

### Security incident logging
Failed PHI access attempts (auth failures, access-denied errors) must also be logged — in a separate `security_events` table. Include: actor (if known), IP, resource attempted, error code.

### Forbidden
- Logging actual PHI values in the log (log field names and record IDs, not field values)
- Allowing the application role to UPDATE or DELETE phi_access_log rows
- Retention < 6 years for access logs
