---
name: sdlc-gdpr-data-subject-rights
description: Use when designing or auditing the data-subject-rights (DSAR) flow for GDPR compliance — covers the eight rights, the response timeline, and the technical implementations that make fulfillment feasible.
---

## Rule

Under GDPR, data subjects have eight rights. The controller (your org) must respond within one month (extendable to three by exception, with notice). Build the technical capability to fulfill each before you collect data — retrofitting is expensive and slow.

## The eight rights

| Right | What it requires |
|---|---|
| **Information** (Art. 13–14) | Tell subjects what data you collect, why, for how long, who you share with — at collection time |
| **Access** (Art. 15) | Provide all personal data you hold, free of charge |
| **Rectification** (Art. 16) | Correct inaccurate data |
| **Erasure / "Right to be forgotten"** (Art. 17) | Delete data, with documented exceptions |
| **Restriction** (Art. 18) | Halt processing without deleting |
| **Portability** (Art. 20) | Provide structured, machine-readable export (JSON, CSV) for transfer |
| **Object** (Art. 21) | Stop processing for marketing, profiling, etc. |
| **Not be subject to automated decisions** (Art. 22) | If a decision affecting the subject is fully automated, allow human review |

## Pattern — DSAR fulfillment pipeline

```
Subject submits request → Identity verified → Routed to fulfillment queue → 
Data assembled from all systems → Reviewed (sometimes legal too) → 
Delivered to subject → Logged in DSAR audit log
```

Build a dashboard for the privacy team:

```
DSAR #1234
- Submitted: 2026-05-20
- Type: Access + Erasure
- Subject ID: usr_abc123
- Status: Assembling data (5/7 systems)
- Due: 2026-06-20
- Owner: privacy@
```

## Technical capability checklist

### Access (Art. 15) — assemble all data

Every PII store needs an "export by user ID" path:

- Primary DB (users, orders, messages — anywhere user_id appears)
- File storage (uploads, exports)
- Search indexes
- Analytics events
- Email service contact lists
- CRM exports
- Backup data (if practical — usually documented as "retained until backup expires")

A single `exportUserData(userId)` orchestrator that walks every store and produces a JSON or ZIP bundle.

### Erasure (Art. 17) — orchestrator

```ts
async function eraseUser(userId: string) {
  await db.users.update(userId, { deleted_at: new Date(), email: null, name: null });
  await searchIndex.delete({ user_id: userId });
  await fileStorage.deletePrefix(`users/${userId}/`);
  await sendgrid.removeContact(userByEmail.email);
  await fcm.deleteTokens(userId);
  await analytics.anonymize(userId);
  await auditLog.write({
    action: "user.erased",
    subject_id: userId,
    actor_id: privacyTeamUser,
    timestamp: new Date(),
  });
  // Note: audit log retained (legal obligation under Art. 17(3)(b))
}
```

Document what's deleted vs anonymized vs retained, and why.

### Portability (Art. 20) — structured export

Same as Access, but with machine-readability emphasis:

```json
{
  "exported_at": "2026-05-20T10:00:00Z",
  "subject_id": "usr_abc123",
  "data": {
    "profile": { ... },
    "orders": [ ... ],
    "messages": [ ... ]
  }
}
```

JSON or CSV. Documented schema. Useful enough that the subject can import elsewhere.

## Identity verification — required

Don't just take a request at face value. Verify:

- Logged-in session for that account, OR
- Email confirmation with a one-time link, OR
- Phone / second factor

Verify *before* assembling data — protects against impersonation.

## Timeline

| Step | Within |
|---|---|
| Acknowledge receipt | Best practice: 72 hours |
| Identity verification | As soon as practicable |
| Fulfill request | 1 month (extendable to 3 by notice, for complex requests) |
| Notify subject if delayed | Within the original month |
| Log fulfillment | At time of completion |

## What CAN refuse / delay

- Excessive / manifestly unfounded requests (very narrow)
- Identity not verified
- Erasure conflict with legal obligation (e.g. financial records retention) — must explain

## Cross-references

- [[sdlc-data-retention]] — what's kept and for how long
- [[sdlc-audit-logging]] — DSAR fulfillment is itself an audit-logged event
- [[sdlc-pii-handling]] — what counts as PII (the data scope of these rights)

## Anti-patterns

- ❌ Manual DSAR fulfillment per request (won't scale; missed deadlines = fines)
- ❌ No identity verification (impersonation risk)
- ❌ Data export missing systems (analytics, search, backups) — incomplete = noncompliant
- ❌ Erasure that doesn't cascade (DB user gone but search index still has them = ghost data)
- ❌ Audit log gets erased along with user data (you need to prove you complied)
- ❌ No fulfillment SLA — month slips silently
- ❌ Asking for "more information than needed to identify you" (data minimization principle)

## Gate criteria

- A DSAR intake form / contact path exists and is published in privacy policy
- An `exportUserData(userId)` orchestrator exists, tested end-to-end
- An `eraseUser(userId)` orchestrator exists, tested end-to-end
- A list of every system holding PII is maintained — used by both orchestrators
- Identity verification step required before fulfillment
- A DSAR tracker / dashboard shows: open requests, due dates, owner, completion status
- A monthly metric: median time-to-fulfill, missed-SLA count
- Audit log records DSAR completions
