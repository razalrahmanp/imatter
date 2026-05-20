---
name: sdlc-data-retention
description: Use when designing storage for any user data, log, or backup — covers the retention-policy questions, deletion mechanics, and the GDPR/regional rules that apply.
---

## Rule

Every data store has a documented retention policy: how long do we keep this, why, and how is it deleted when the time comes? "Forever" is not a policy. "Until someone asks us to delete" is not enough. Decide up front; build the deletion into the system.

## The three questions

For every data class, answer:

1. **How long do we keep it?** (and why — legitimate interest, contract, legal obligation, consent)
2. **How is it deleted?** (hard delete, soft delete with purge, anonymize)
3. **Who can trigger early deletion?** (DSAR pipeline, admin tool, automatic on account deletion)

## Common retention windows (starting points — verify per jurisdiction)

| Data class | Typical retention |
|---|---|
| Account profile (active) | Until user deletes or 2 years inactive |
| Account profile (deleted) | 30 days soft-delete, then hard-purge |
| Application logs | 30–90 days |
| Audit logs | 1–7 years (compliance-driven) |
| Financial records / invoices | 7 years (SOX) or local law minimum |
| Healthcare records (HIPAA) | 6 years from creation or last touch |
| Marketing data | Until consent withdrawn |
| Analytics events | 14 months (Google Analytics default) or shorter |
| Cookies | Per cookie law in jurisdiction (≤13 months for tracking in EU) |
| Webhook receipts | 30 days post-processing |
| Backups | 30–90 days (longer if regulated) |
| Search indexes | Aligned with source data retention |

## Deletion mechanics

| Mechanism | When |
|---|---|
| **Hard delete** | DSAR fulfillment, GDPR Article 17 requests, user account deletion |
| **Soft delete + scheduled purge** | Default for user-initiated delete; allows undo within window |
| **Anonymization** | When you want aggregate data but no identifiability (replace `user_id` with a one-way hash, null PII fields) |
| **Tombstoning** | Distributed systems where deletes propagate (Cassandra-style); convert to anonymized after replication |

```sql
-- Soft delete pattern
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Application queries always filter:
SELECT * FROM users WHERE deleted_at IS NULL;

-- Nightly purge:
DELETE FROM users WHERE deleted_at < now() - INTERVAL '30 days';
```

## Cascading deletes — the hard part

User deletion isn't just a row removal. Every place that touches the user must be cleaned:

- DB rows in tenant-owned tables (foreign-keyed)
- Files in object storage (user uploads, exports)
- Search index documents
- Cache entries (memcached, Redis)
- Analytics events (if you're the controller)
- Email service contact lists (SendGrid, Mailchimp)
- Push notification tokens (FCM, APNs)
- Audit logs — usually retained (legal obligation), anonymized
- Backups — addressed by retention policy of backups themselves

Build a `deleteUser(userId)` orchestrator that walks every store. Document what's deleted vs anonymized vs retained.

## Backup retention

Backups are themselves data and have their own retention:

- **30 days** for operational recovery is enough for most apps
- **90 days** if you need quarter-end audit recovery
- **1+ year** only with specific legal need; longer means longer DSAR-compliance burden

When a user deletes their data, their data still lives in backups until those backups expire. Document this in your privacy policy.

## Anti-patterns

- ❌ "We never delete anything" without a documented legal basis
- ❌ Hard-deleting on user request without a soft-delete window (no undo)
- ❌ Deleting from primary DB but not search index / cache / object storage
- ❌ Cron job that "should" purge expired records but no metric proves it ran
- ❌ Retention policy in a slide deck, not in code (no enforcement)
- ❌ One global retention policy for all data classes (different data has different needs)
- ❌ Anonymization that's reversible (hash with deterministic salt that's stored alongside)

## Gate criteria

- A retention-policy document exists, listing every data class and its retention
- The policy is mirrored in code: each table/store has a documented retention setting
- Scheduled purges run on a verifiable schedule with a metric / alert if they don't
- A `deleteUser(userId)` orchestrator exists and is tested end-to-end
- Privacy policy reflects the actual retention windows (not legalese fiction)
- Audit logs are exempt from user-driven deletion (with documented legal basis)
