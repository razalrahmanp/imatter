---
id: oncall-handoff
title: "On-call handoff — active incidents, recent changes, known issues, contacts"
layer: practice
tags: [oncall, handoff, operations, sre, shift-change]
applies_to:
  task_types: [any]
  stages: [7, 10]
size_tokens: 185
related: [incident-response, runbook-pattern, postmortem-blameless]
---

# oncall-handoff — On-Call Handoff Pattern

## Pattern Summary

A handoff is complete when the incoming engineer has enough context to handle any incident without calling the outgoing engineer. If the outgoing engineer still needs to explain things verbally, the written handoff is incomplete.

**Handoff document (post before the shift ends):**
```markdown
# On-Call Handoff — <date> → <date>

## Active incidents
| Incident | Severity | Status | Next action | Owner |
|---|---|---|---|---|
| Orders timeout #342 | P1 | Mitigated, monitoring | Confirm stable for 2h | @you |

(If none: "No active incidents.")

## Ongoing investigations
Items being worked but not incidents — things the incoming engineer should monitor.

## Recent deployments (last 48h)
| When | What | Deploy link | Notes |
|---|---|---|---|
| 2026-05-20 14:28 | auth: JWT refresh fix | [link] | Rolled back once, stable after retry |

## Known flaky alerts
Alerts firing this shift that are known false positives — and why.

## Elevated risk areas
Code or infrastructure that's fragile right now: a pending migration, a service with high error rate, a dependency with known instability.

## Useful links
- Dashboard: [link]
- Logs: [link]
- Deploy console: [link]
- Escalation contact: @name (mobile: in 1Password)
```

## Full Reference

### Handoff timing
Post the handoff document 30 minutes before the shift ends. Allow 15 minutes for Q&A overlap. Do not hand off in the middle of an active P0/P1 — stabilise first.

### Async vs sync handoffs
For routine shifts: written handoff is sufficient. For P0 in progress or elevated risk: sync call required. The written doc supplements the call, it doesn't replace it.
