---
id: change-management-evidence
title: "SOC 2 change management evidence — CC8.1 approval, testing, deployment artifacts"
layer: compliance
compliance_module: soc2
tags: [soc2, change-management, cc8, evidence, audit, compliance]
applies_to:
  task_types: [add-feature, modify-handler, schema-migration, deploy]
  stages: [7, 10]
size_tokens: 205
related: [access-review-pattern, incident-evidence, audit-logging]
---

# change-management-evidence — SOC 2 Change Management Evidence (CC8.1)

## Pattern Summary

SOC 2 CC8.1 requires evidence that changes are authorized, tested, and approved before production deployment. Evidence must be collectable without extra effort — build it into the deployment pipeline.

**CC8.1 evidence checklist (per change):**
```
□ Change request or PR with description of what changed and why
□ Ticket/issue reference linking change to a business requirement
□ Code review — at least one approver who is not the author
□ Automated test results (CI pass) — linked to the specific commit
□ Pre-production test confirmation (staging environment sign-off)
□ Approval from authorized person before production deployment
□ Deployment timestamp and deployer identity
□ Post-deployment validation (smoke test result or monitoring check)
□ Rollback plan documented (or rollback PR reference)
```

**Change record schema:**
```typescript
interface ChangeRecord {
  change_id:        string;   // PR number or ticket ID
  title:            string;
  environment:      "staging" | "production";
  deployed_at:      string;
  deployed_by:      string;   // user ID — not name (name changes)
  approved_by:      string;   // must differ from deployed_by
  pr_url:           string;
  ci_run_url:       string;
  tests_passed:     boolean;
  rollback_ref:     string;   // PR or commit that would undo this change
  post_deploy_ok:   boolean;
}
```

**Store change records in an append-only table — auditors will query this directly:**
```sql
CREATE TABLE change_records (
  change_id      text PRIMARY KEY,
  title          text NOT NULL,
  environment    text NOT NULL,
  deployed_at    timestamptz NOT NULL,
  deployed_by    text NOT NULL,
  approved_by    text NOT NULL,
  pr_url         text NOT NULL,
  ci_run_url     text NOT NULL,
  tests_passed   boolean NOT NULL,
  rollback_ref   text,
  post_deploy_ok boolean
);
-- No UPDATE or DELETE — auditors must see original records
```

## Full Reference

### Emergency change procedure
For P0 hotfixes deployed without full pre-production testing: deploy with emergency approval from owner/admin, flag as `emergency: true` in change record, complete retrospective review within 24 hours, update record with retrospective sign-off.

### SOC 2 auditor evidence package
Auditors typically request: PR list for the audit period, CI logs, deployment approvals. Automate the export: query `change_records` filtered by date range.

### Forbidden
- Self-approving production deployments (approver must differ from deployer)
- Deploying without a CI pass (even for hotfixes — run at minimum a smoke test)
- Deleting or updating historical change records
