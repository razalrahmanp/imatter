---
name: sdlc-soc2-incident-evidence
description: Use when preparing incident-response evidence for SOC 2 (CC7.3 — security incident detection and response) — covers what to capture during and after every incident, and what the auditor wants to see.
---

## Rule

SOC 2 expects an incident-response capability: detection, triage, response, communication, post-incident review. Each incident produces an evidence trail. Auditors sample incidents and ask "show me what happened and what you did."

## Evidence per incident

| Evidence | Source |
|---|---|
| Detection — what triggered investigation | Alert, customer report, internal discovery |
| Initial triage — severity, classification | Incident doc; assigned IC |
| Timeline — every action, every observation | Scribe notes during incident |
| Communication — internal + external | Slack archive, status page log, customer emails |
| Containment — what was done to stop the impact | Specific actions: revoke creds, isolate system, deploy fix |
| Eradication — root cause addressed | Patch, config change, dependency update |
| Recovery — full restoration | Verification steps; back to baseline metrics |
| Post-mortem — review document | Linked PRs, action items, status |

## Pattern — incident document template

```markdown
# Incident: <one-line summary>
- **Date:** YYYY-MM-DD
- **Detected:** <time / source>
- **Severity:** SEV-N
- **Status:** Resolved
- **IC:** <name>
- **TL:** <name>

## Timeline (UTC)
| Time | Event |
|---|---|
| 14:03 | Alert: auth-api 5xx > 5% |
| 14:05 | On-call ack |
| 14:08 | IC declared; status page updated |
| ... | ... |

## Detection
<How we noticed.>

## Impact
- Users affected: <count or scope>
- Duration: <start to end>
- Data implications: <PII exposed? lost? — explicitly note "none" if clean>

## Root cause
<The technical chain.>

## Response actions
- Containment: ...
- Eradication: ...
- Recovery: ...

## Customer communication
- Status page: <link>
- Email to affected: <count, link to template>

## Post-mortem
- Document: <link>
- Action items: <count complete / total>

## SOC 2 control mapping
- CC7.3 — Incident response ✓
- Other controls touched: CC6.X (access), CC8.X (change mgmt if patch deployed)
```

## Communication evidence

The auditor wants to see that affected parties were informed:

- **Internal**: incident Slack channel archive (or whatever you use); shows real-time decision-making
- **Customer-facing**: status page history (Statuspage, Instatus, self-hosted)
- **Major impact**: email to customers, with samples retained
- **Regulators (if applicable)**: GDPR breach notification, HIPAA breach notification (different from SOC 2 but adjacent)

## What counts as an "incident"

Most teams over-classify (every minor blip becomes "an incident") or under-classify (only customer-impacting outages). Be consistent:

- **Security incident**: confirmed or strongly suspected compromise of confidentiality, integrity, or availability
- **Operational incident**: user-facing failure (outage, degradation)
- **Near-miss**: discovered before user impact; document anyway

A documented severity matrix (see [[sdlc-incident-response]]) helps consistency.

## Tools that produce evidence

| Tool | What it captures |
|---|---|
| **PagerDuty / Opsgenie** | Alert, ack, escalation, resolution timing |
| **Slack** | Incident channel archive |
| **Statuspage** | External communication timeline |
| **Linear / Jira** | Incident ticket + action items |
| **GitHub** | PRs for fixes, linked to incident |
| **Document tool** | Post-mortem itself |

Choose your stack such that each phase emits evidence automatically.

## Retention

SOC 2 audit period is typically 6 months (Type II). Retain incident docs and supporting evidence for at least 1 year, ideally longer (3+ years for trend analysis).

## Tabletop exercises

Auditors look favorably on documented practice incidents:

- Quarterly: tabletop walking through a hypothetical scenario
- Annual: more elaborate "game day" with actual response actions in staging
- After-action notes from these go in the evidence pile too

## Anti-patterns

- ❌ Verbal-only incident response; no written trail
- ❌ Incident doc started days after the incident (recall biased; gaps)
- ❌ Post-mortem skipped for SEV-2 incidents ("not severe enough")
- ❌ Action items have no owner / no due date
- ❌ Customer communication only after resolution ("we already fixed it")
- ❌ Incident "resolved" but no validation that impact ended
- ❌ Reusing the same incident channel across multiple incidents (loses isolation)
- ❌ No severity scoring — every incident is treated the same

## Cross-references

- [[sdlc-incident-response]] — the operational pattern
- [[sdlc-postmortem-blameless]] — the post-mortem format
- [[sdlc-soc2-change-management-evidence]] — fixes deployed are CC8 evidence
- [[sdlc-soc2-access-review-pattern]] — incidents that involve access changes

## Gate criteria

- A documented severity matrix exists
- Every incident produces a doc following the template
- Post-mortems exist for all SEV-1 and SEV-2 within 5 business days
- Action items have owner + due date + completion tracking
- Status page is updated for any customer-affecting incident
- Quarterly tabletop exercise + annual game day documented
- Incident docs and evidence retained ≥ 1 year
