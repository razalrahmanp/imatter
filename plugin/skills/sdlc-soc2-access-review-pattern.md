---
name: sdlc-soc2-access-review-pattern
description: Use when preparing access-review evidence for SOC 2 (CC6.1, CC6.2, CC6.3) — covers the quarterly review process, what to verify, and how to produce auditor-ready output.
---

## Rule

SOC 2 requires periodic access reviews — quarterly is typical. The review verifies that every user with access to production systems / customer data still needs it. Departed employees are revoked promptly; role changes trigger access changes. Evidence is the reviewer's signed-off list.

## What to review

| System | Why |
|---|---|
| Production cloud (AWS, GCP) | Highest privilege; biggest blast radius |
| Production DB | Direct data access |
| Source code (GitHub) | Code-deploy path |
| CI/CD (deployment tools) | Can push to production |
| Customer-data SaaS (Datadog, Sentry, Segment, etc.) | PII / system metadata |
| Auth provider (Cognito, Okta, Auth0) | User management |
| Privileged internal tools (admin dashboards) | Cross-tenant impersonation |

Lower priority but should be reviewed:
- Documentation tools (Confluence, Notion)
- Communication (Slack workspaces)
- Email lists with sensitive distribution

## Quarterly review process

```
Day 1 — Pull current access lists:
  For each system: who has what role?
  Compare against HR system: any departed employees still listed?

Day 1–7 — Distribute to managers:
  Each manager gets list of their team's access.
  "Confirm this is still appropriate."

Day 7–14 — Managers respond:
  - Keep (still needed)
  - Reduce (downgrade role)
  - Remove (no longer needed)

Day 14 — Apply changes:
  Access modifications made.
  Confirmations logged.

Day 14 — Generate evidence:
  Signed-off list per system.
  Diff: before / after / who approved each change.
  Stored as quarterly artifact.
```

## Pattern — access inventory

```ts
interface AccessRecord {
  user_id: string;
  system: string;          // "aws-prod", "github", "datadog"
  role: string;            // "admin", "developer", "read-only"
  granted_at: Date;
  granted_by: string;
  last_used_at: Date | null;
  reviewed_at: Date | null;
  reviewer: string | null;
}
```

Build a quarterly snapshot of this for each system. Diff against last quarter and against HR's "active employees" list.

## Common issues to catch

| Issue | Example |
|---|---|
| Departed employee still has access | Joined 2y ago, left 6mo ago, still listed |
| Role mismatch | Junior dev with `admin` role from temporary project |
| Service accounts owned by people who left | Bot account in someone's name only |
| Shared accounts | "deployer" used by 5 people |
| Stale access | Hasn't logged in for 6 months |
| Privilege creep | Added permissions over time, never reduced |
| External / contractor accounts | Contractor finished but account remained |

## Automated checks (run weekly, not just quarterly)

- New user added with privileged role → notify security
- User in HR system marked terminated → automated revocation within 24h
- User hasn't logged in for 90 days → flag for review
- Privilege escalation event → log and alert
- Service account credential aged > 90 days → notify owner

These continuous checks complement the quarterly deep dive.

## Termination workflow

Standard offboarding when an employee leaves:

```
Day 0 — Termination effective:
  HR triggers offboarding workflow.
  Auto-revoke: SSO disabled across all integrated systems.
  Forwarding: email forwarded to manager.
  
Day 0–1 — Manual revocations for non-SSO systems:
  Direct DB access removed.
  Cloud console access removed if non-SSO.
  Personal API keys / tokens revoked.
  
Day 0–7 — Equipment + data:
  Devices wiped or returned.
  Personal access removed from physical spaces.
  
Day 1+ — Logged in audit log; evidence retained.
```

A delayed termination (employee retains access for days) is a SOC 2 finding.

## Evidence package per quarter

Per system, deliver:

1. Snapshot of current users + roles
2. Diff vs previous quarter
3. Manager sign-off (email / form / ticket)
4. Changes made (revocations, downgrades)
5. Confirmation of completion

Filename example: `2026-Q2_access_review_aws-prod.pdf`

## Anti-patterns

- ❌ Annual review only (auditor expects quarterly or more)
- ❌ Reviewer is the same person whose access is being reviewed
- ❌ "All looks fine" responses without actually checking
- ❌ Termination relies on HR remembering to file a ticket
- ❌ Service accounts not reviewed (they age out and accumulate)
- ❌ Shared accounts ("ops" with shared password)
- ❌ No automation — quarterly review is 80% manual spreadsheet work
- ❌ SSO not integrated with all critical systems

## Cross-references

- [[sdlc-soc2-change-management-evidence]] — sister SOC 2 control
- [[sdlc-soc2-incident-evidence]] — also SOC 2
- [[sdlc-authn-pattern]] — identity model

## Gate criteria

- Quarterly access review process documented and scheduled
- Continuous automation runs weekly checks (terminated users, stale access, privilege changes)
- SSO integrated with critical systems; access modifications via SSO group changes
- Termination workflow tested and demonstrably ≤ 24 hours from HR notice
- Quarterly evidence package archived
- No shared / generic accounts in privileged systems
- Service accounts owned by groups / mailing lists, not individuals
