---
id: access-review-pattern
title: "SOC 2 access review — CC6.3 quarterly review, de-provisioning, evidence"
layer: compliance
compliance_module: soc2
tags: [soc2, access-review, cc6, de-provisioning, principle-of-least-privilege, compliance]
applies_to:
  task_types: [add-admin, add-worker, modify-handler]
  stages: [6, 10]
size_tokens: 200
related: [change-management-evidence, incident-evidence, audit-logging]
---

# access-review-pattern — SOC 2 Access Review (CC6.3)

## Pattern Summary

SOC 2 CC6.3 requires periodic review of user access. Access must be revoked promptly when no longer needed. Evidence of the review must be retained.

**Access review schedule:**
```
Quarterly: all production system access (AWS IAM, RDS, admin portal)
On-event:  immediately on role change, departure, or project end
```

**Access review record schema:**
```typescript
interface AccessReviewRecord {
  review_id:     string;
  reviewed_at:   string;       // ISO 8601
  reviewed_by:   string;       // user ID of reviewer
  period_start:  string;       // quarter start
  period_end:    string;       // quarter end
  entries: {
    user_id:       string;
    user_email:    string;
    role:          string;
    system:        string;     // "aws-iam" | "rds" | "admin-portal" | "cognito-admin"
    access_since:  string;
    still_needed:  boolean;
    action_taken:  "retained" | "revoked" | "downgraded";
    actioned_at?:  string;
    actioned_by?:  string;
  }[];
}
```

**De-provisioning pattern — revoke first, log second:**
```typescript
async function revokeAccess(userId: string, system: string, reviewId: string): Promise<void> {
  // 1. Revoke in the system (order matters — revoke BEFORE logging)
  if (system === "cognito-admin") {
    await cognito.adminDisableUser({ UserPoolId: ADMIN_POOL_ID, Username: userId });
  } else if (system === "rds") {
    await db.query("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM $1", [userId]);
  }
  // 2. Record the action
  await db.query(
    "INSERT INTO access_events (user_id, system, action, review_id, occurred_at) VALUES ($1,$2,'revoked',$3,NOW())",
    [userId, system, reviewId]
  );
}
```

## Full Reference

### Principle of least privilege
Every account should have only the permissions required for its current function. At each review, question existing permissions — don't just approve the status quo.

### Leavers process
Within 24 hours of departure notice: disable all accounts, rotate any shared credentials the leaver had access to, transfer ownership of owned resources.

### Evidence package for auditors
Export `access_review_records` for the audit period. Auditors want to see: who reviewed, when, what decisions were made, and that revocations happened promptly (check `actioned_at - review date`).

### Forbidden
- Reviewing access more than 90 days apart (quarterly = max 90 days)
- Approving access "for now" without a documented justification
- Revoking without logging — the audit trail requires both sides of the action
