---
name: sdlc-audit-logging
description: Use when implementing actions that affect security, billing, or shared data (role changes, deletes, admin actions, financial transactions) — separate from operational logs, must be tamper-resistant.
---

## Rule

Audit logs are not application logs. They record *who did what to which resource and when*, for compliance, forensics, and dispute resolution. They are append-only, tamper-resistant, and retained per policy — typically longer than operational logs.

## What goes in the audit log

| Event class | Examples |
|---|---|
| Auth events | Login, logout, MFA enrollment, MFA challenge passed/failed, password change |
| Privilege changes | Role assigned/removed, permission granted/revoked, API key created/rotated/deleted |
| Sensitive data access | Reading another user's PII (admin viewing customer details), exporting data |
| Financial events | Charge created, refund issued, plan changed, subscription canceled |
| Configuration changes | Feature flag toggle, security policy change, allowlist edit |
| Destructive actions | Delete (any tenant-owned data), purge, archive |
| Compliance actions | DSAR fulfillment (GDPR), data retention purge, consent change |
| Cross-tenant actions | Support staff impersonation, cross-tenant data move |

What does NOT go in audit log:
- Operational events (request received, cache hit, retry attempted) — those belong in regular logs
- Reads of one's own data (too noisy; not security-relevant unless under suspicion)

## Standard shape

```json
{
  "audit_id": "aud_01H...",
  "ts": "2026-05-20T10:30:00.123Z",
  "actor_id": "usr_abc123",
  "actor_type": "user",
  "actor_ip": "203.0.113.10",
  "actor_session_id": "sess_xyz",
  "action": "role.assigned",
  "resource_type": "user",
  "resource_id": "usr_def456",
  "tenant_id": "tnt_xyz789",
  "before": { "role": "staff" },
  "after": { "role": "admin" },
  "request_id": "req_01H...",
  "user_agent": "Mozilla/5.0..."
}
```

| Field | Purpose |
|---|---|
| `audit_id` | Immutable unique ID for the audit entry |
| `ts` | When |
| `actor_*` | Who (and from where) |
| `action` | What (use a controlled vocabulary like `<resource>.<verb>`) |
| `resource_*` | On which thing |
| `tenant_id` | For multi-tenant |
| `before` / `after` | For mutations — the diff |
| `request_id` | Correlation with operational logs |

## Action vocabulary — controlled

Use `<resource>.<verb>` format with a fixed verb set:

```
user.login.success
user.login.failure
user.role.assigned
user.role.removed
user.password.changed
user.mfa.enrolled
user.mfa.removed
order.cancelled
order.refunded
api_key.created
api_key.revoked
data.exported
data.deleted
tenant.suspended
admin.impersonation.started
admin.impersonation.ended
```

A fixed vocabulary makes audit logs queryable and tools easier to build.

## Storage

Audit logs must be:

| Property | Why |
|---|---|
| **Append-only** | Tamper resistance — no `UPDATE` or `DELETE` allowed |
| **Centralized** | Forensic queries cross many services |
| **Long-retained** | Compliance (GDPR: as long as needed for legal claims; HIPAA: 6 years; SOX: 7 years) |
| **Restricted access** | Read access logged itself (meta-audit) |
| **Time-stamped reliably** | Server clock, not user-supplied |

Common implementations:
- Separate database (`audit_log` DB) with revoked DELETE/UPDATE permissions for app role
- Append-only object storage (S3 with object lock) for very long retention
- Dedicated tools (AWS CloudTrail, Datadog Audit Trail, Cribl)

## Pattern — write inline with the action

```ts
async function assignRole(actor: User, targetUserId: string, newRole: Role) {
  const target = await db.users.findById(targetUserId);
  const oldRole = target.role;

  await db.transaction(async (tx) => {
    await tx.users.update(targetUserId, { role: newRole });
    await tx.audit_log.insert({
      audit_id: ulid(),
      ts: new Date(),
      actor_id: actor.id,
      actor_ip: actor.ip,
      action: "user.role.assigned",
      resource_type: "user",
      resource_id: targetUserId,
      tenant_id: actor.tenant_id,
      before: { role: oldRole },
      after: { role: newRole },
      request_id: actor.request_id,
    });
  });
}
```

Writing the audit log inside the same transaction as the change means it's atomic — you cannot have the change without the log.

## Anti-patterns

- ❌ Audit logs in the same table as application logs (different access patterns, different retention)
- ❌ Audit logs writable by the app role (should be append-only, ideally to a different role)
- ❌ Free-form action strings (`"changed something"`) — impossible to query
- ❌ Omitting `before` values on mutations (you can't reconstruct what changed)
- ❌ Logging the action but not the actor (useless for forensics)
- ❌ Audit log alongside the change but not in the same transaction (split-brain on failure)
- ❌ Including the full request body (may contain PII; defeats minimum-data principle)

## Gate criteria

- An `audit_log` table or equivalent exists, separate from operational logs
- The app role has INSERT but not UPDATE/DELETE on it
- A controlled vocabulary of `action` values is documented somewhere queryable
- Every privilege change, financial event, destructive action, and admin action writes an audit entry inside the same transaction as the change
- Audit log retention policy is documented and enforced
- A simple "who did X to me" query is possible against the log
