---
name: sdlc-incident-response
description: Use when an active production incident is occurring or after one has been resolved — covers the severity model, the response process, the roles, and what to do in the first 10 minutes.
---

## Rule

When something is wrong in production, the team needs a small set of practiced moves: classify severity, assemble the right people, communicate continuously, mitigate (not fix), then resolve. Speed comes from rehearsal, not heroics.

## Severity model — keep it small

| Severity | Definition | Response |
|---|---|---|
| **SEV-1** | Total outage, data loss, security incident affecting users | Wake everyone. All hands. Customer comms ASAP. |
| **SEV-2** | Major function broken; significant user impact | Page on-call immediately. Customer comms within hours. |
| **SEV-3** | Degraded; some users affected; workaround exists | Page during business hours. Internal tracking. |
| **SEV-4** | Minor; few users; cosmetic or non-functional | Ticketed; resolved next sprint. |

A confused team picks SEV-2 by default. Make the definitions specific to your business (revenue impact, data loss, user count).

## The first 10 minutes — checklist

```
00:00 — On-call ackn alert
        Open the incident channel (#incident-<id>)
        Page Incident Commander (IC) if not already on-call
00:02 — IC: declare severity
        Status page: "Investigating reports of <symptom>"
00:04 — IC: identify Tech Lead (TL) and Scribe
        TL begins diagnosis
        Scribe begins timeline in incident doc
00:06 — TL: hypothesize cause
        Mitigation options identified
        IC: customer comms cadence decided (every 15 / 30 / 60 min)
00:08 — TL: mitigate (revert, scale, failover, kill switch)
        Verify user impact reducing
00:10 — IC: status update on status page
        TL/SREs continue diagnosis post-mitigation
```

These are deliberate. "Mitigate before fix" is critical — stop the bleeding, then debug.

## Roles — small team, clear hats

| Role | Who | What |
|---|---|---|
| **Incident Commander (IC)** | First on-call or escalated | Owns the incident. Makes calls. Coordinates. Communicates externally. |
| **Tech Lead (TL)** | Deepest in the affected system | Owns diagnosis and mitigation steps. Pairs with IC on decisions. |
| **Scribe** | Anyone | Keeps the timeline. Records every action. |
| **Comms** | Marketing/Support if available | Status page updates, customer responses |
| **Sweepers** | Other engineers | Pull related work; investigate side effects |

For small teams: IC and TL are often the same person. Scribe always separate (the IC's brain is full).

## Mitigation — what to try first

Always before fixing — these stop the bleeding fast:

1. **Rollback the recent deploy** (if symptoms started right after one)
2. **Failover** (if a region/zone/instance is degraded)
3. **Scale up** (if it's load-related)
4. **Feature flag off** (if a recent feature caused it)
5. **Rate limit / shed load** (last resort for total overload)

Each of these is reversible quickly if it didn't help. Diagnosis can continue while mitigated.

## Communication — internal

In the incident channel, post:

- Every action taken ("I'm rolling back deploy abc to def")
- Every observation ("CPU is now 40%, was 95%")
- Every uncertainty ("we don't know yet why X")

Verbosity prevents "what's going on?" from blocking work. The scribe distills into a clean timeline later.

## Communication — external

Use a status page (Statuspage, Instatus, self-hosted). Frequency:

| Severity | Update cadence |
|---|---|
| SEV-1 | Every 15 minutes |
| SEV-2 | Every 30 minutes |
| SEV-3 | At start, mid-point if long, at resolution |

Template messages:

> **Investigating** — We are investigating reports of <symptom>. We'll update in 15 minutes.
> **Identified** — We've identified the cause and are working on a fix. Expected resolution: <time>.
> **Monitoring** — A fix has been deployed and we're monitoring. <Symptom> should be resolved.
> **Resolved** — The issue is resolved. We'll publish a post-mortem within 5 business days.

Don't promise specific times unless you're confident. "Soon" is fine; "in 12 minutes" can backfire.

## Resolution

Defined as: the system has been stable at full health for a defined window (15 min for SEV-1/2; 1 hour for SEV-3 is reasonable).

Then:
1. IC declares resolved
2. Status page → Resolved
3. Customer follow-up email (SEV-1/2)
4. Post-mortem scheduled

## Post-mortem — blameless

See [[sdlc-postmortem-blameless]] for the format. The point:

- What happened (timeline)
- What was the technical root cause
- What was the contributing factors (process, monitoring, knowledge gaps)
- What we changed (action items with owners and dates)
- What we did well (don't only focus on failures)

Blameless means: assume everyone acted reasonably given what they knew. Find systemic gaps, not individual fault.

## Pre-incident — investments that pay off

- **Runbooks** ([[sdlc-runbook-pattern]]) — playbook for known failures
- **Game days** — quarterly: deliberately break something in staging; practice response
- **On-call rotation** — humane and clear (see [[sdlc-oncall-handoff]])
- **Escalation policy** — who to wake when the on-call is overwhelmed
- **Status page templates** — pre-written for common scenarios
- **Communication channels** — incident channel template; comm-team contact
- **Customer touchpoints** — who notifies enterprise customers, who handles social, who emails

Practice when nothing's on fire so the moves are muscle memory when it is.

## Anti-patterns

- ❌ No declared IC — chaos; no decisions get made
- ❌ Trying to fix without mitigating first (users bleed while you debug)
- ❌ Quiet incident — others on the team don't know it's happening
- ❌ One-line "we're looking into it" status updates for hours
- ❌ Blaming individuals in retro ("Bob deployed at 4pm Friday") — find systemic causes
- ❌ Action items from retros that have no owner or date
- ❌ Customer comms only after resolution ("we had an outage you noticed for 2 hours")
- ❌ Reverting deploys without confirming it was the trigger (chasing wrong cause)
- ❌ Ad-hoc severity classification ("this feels like a SEV-3") — define explicitly
- ❌ Single point of failure on incident knowledge — only one person knows the system

## Gate criteria

- A severity matrix is documented for the team
- IC and TL responsibilities are written and team trained
- Runbooks exist for the top 10 alert classes
- A pre-built incident-doc template exists (timeline + decision log structure)
- Status page configured with templates
- Game-day exercise scheduled at least quarterly
- All resolved SEV-1 and SEV-2 incidents have a post-mortem within 5 business days
- Post-mortem action items have owners and due dates and are tracked to completion
