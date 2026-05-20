---
name: sdlc-soc2-change-management-evidence
description: Use when preparing for a SOC 2 audit (CC8) — covers what change-management evidence auditors look for and how to make it discoverable in normal engineering workflow.
---

## Rule

SOC 2 (Common Criteria 8.1 — Change Management) asks for evidence that changes are authorized, tested, and documented. The auditor will sample changes and ask for the evidence. Make the evidence a byproduct of normal work — don't manufacture it for the audit.

## What auditors look for

For a sampled change (PR, deployment, config change), they want to see:

| Evidence | Source |
|---|---|
| Change request / ticket | Jira / Linear / GitHub Issues |
| Code review | PR with approval from someone other than the author |
| Testing | Test run output (CI green) |
| Approval to deploy | CI/CD pipeline log, deployer permissions |
| Deploy evidence | Deploy timestamp, who/what triggered, success |
| Rollback procedure (if any) | Runbook, prior deploys showing rollback worked |

Everything traceable from the change request to the production deploy, by audit ID.

## Pattern — link the chain

```
Issue (REQ-1234)
  ↓ referenced in
PR title ("REQ-1234: Add export endpoint")
  ↓ approved by
Reviewer (sso-authenticated GitHub identity)
  ↓ merged to main → CI runs
CI pipeline (run #5678, all green)
  ↓ deployed to staging
Deploy log (timestamp, SHA, deployer = bot or human SSO ID)
  ↓ promoted to production via
Production deploy approval (manual or CI-gated, logged)
  ↓ production deploy
Deploy log (timestamp, SHA, deployer)
```

Each link should be one-click traversable.

## Standard evidence — automate it

| Evidence | Automate via |
|---|---|
| PR linked to issue | Branch naming (`feat/REQ-1234-...`) + commit messages |
| Required approvals | GitHub branch protection: ≥1 reviewer, code owners enforced |
| Tests pass | CI is required check on PR; cannot merge red |
| Deployer authorization | CI pipeline uses scoped service account; no manual deploys |
| Deploy logged | CI emits deploy event to a central log (e.g. Datadog Events) |

If your auditor has to email people to find each piece, you're paying audit cost in real time. If the auditor can click from issue to deploy in your tools, you've already won.

## CI artifact retention

Keep CI logs / test reports for at least the audit window (1 year typical). Some teams archive to S3 with object lock for compliance.

## Self-review / paired commits

Auditors don't love these — "Bob's PR approved by Bob via paired-programming attestation" is hard to verify. Either:

- Require ≥ 1 other-than-author approval on all paths
- Document pair-programming as a control (with attestation log)

The first is simpler.

## Emergency changes — break-glass

You'll occasionally need to bypass the normal process (urgent prod fix at 3am). Document the break-glass procedure:

- Who can invoke (specific senior on-call)
- How it's logged (Slack incident channel + JIRA after-fact ticket)
- Post-mortem within a defined window (e.g. 48 hours)
- Auditor will sample these — be ready to show the trail

## Anti-patterns

- ❌ Direct commits to main (no PR, no review, no evidence)
- ❌ Self-approvals (no separate reviewer)
- ❌ Merge button disabled but bypassed by admins regularly
- ❌ CI flake tolerated (red builds merged "because flaky")
- ❌ Deploys from laptops with personal credentials
- ❌ Generic ticket "fix bug" without scope or testing notes
- ❌ Evidence in screenshots (auditor wants the source)
- ❌ Manual change log maintained by hand (always behind reality)

## Cross-references

- [[sdlc-pr-description-template]] — what reviewers should see
- [[sdlc-code-review-checklist]] — review depth
- [[sdlc-commit-message-convention]] — commit linkage to tickets
- [[sdlc-soc2-access-review-pattern]] — who can deploy / approve

## Gate criteria

- Branch protection on main requires ≥ 1 reviewer (not the author) and passing CI
- Direct pushes to main blocked (admins enforce same rule on themselves)
- Deploy pipeline is the only path to production
- CI logs retained for ≥ 1 year
- Issue tracker linked to every PR (enforced by template or convention)
- Break-glass process documented and rarely used; each invocation post-mortemed
- An auditor-friendly trail exists for a sampled change: ticket → PR → review → CI → deploy
