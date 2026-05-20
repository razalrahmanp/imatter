---
name: sdlc-oncall-handoff
description: Use when handing off on-call duty (rotation change, vacation coverage) — covers what context the next on-call needs, format of the handoff, and what makes rotations humane.
---

## Rule

On-call works only if the handoff is good. The incoming on-call should walk into the rotation knowing what's currently broken, what's been brittle, and what's expected to break. The outgoing on-call writes the handoff before signing off.

## Handoff template

```markdown
# On-call handoff — <date> from <outgoing> to <incoming>

## Active incidents
<Anything still open. Even if mitigated.>
- [ ] Order-API: degraded since Tuesday, mitigated by reverting deploy; root cause not yet identified. See incident #2024-05-18.

## Brittle areas this week
<Things that fired alerts but weren't full incidents. Watch for them recurring.>
- DB connection pool exhaustion on `orders-api` — happened twice; pool sized up. Watch.
- Razorpay timeouts last Thursday 14:00 IST; they didn't follow up.

## Scheduled / planned
<Maintenance windows, deploys, marketing events.>
- Database upgrade Wednesday 03:00 UTC; runbook at <link>.
- Marketing campaign launches Friday — expect 3× traffic on /signup.

## New things this week
<Features that shipped or are about to. They're the new failure surface area.>
- Checkout v2 rolled out to 20% of users Monday. Feature flag: `checkout_v2`.
- New webhook integration with Acme Corp; verify their signature.

## Open action items (from last week's incidents / handoffs)
- [x] Added alert for queue depth (Alice, closed)
- [ ] Update Stripe webhook runbook (Bob, in progress)

## On-call notes
<Anything weird, unresolved, or that the incoming might wonder about.>
- Datadog dashboard URL changed; bookmark <link>.
- @lucy is OOO Wed; escalate Postgres issues to @sam instead.

## Signed off
<Outgoing> at <time>
<Incoming> acknowledges at <time>
```

## What makes rotations humane

| Practice | Why |
|---|---|
| **One-week rotations** (or shorter) | Two-week rotations burn people out; one-week with a backup is sustainable |
| **Pair on-call**: primary + backup | Backup helps debug; primary doesn't carry alone |
| **Daytime-only for the first month for new engineers** | Soft entry; nights and weekends require seniority |
| **Compensate fairly** | Time-off-in-lieu, pager pay, or both |
| **Page tax** = max 1 page per night sustainable | If pages > 1/night, the rotation isn't humane; fix alerts/runbooks |
| **Right of refusal** | Anyone can decline a rotation if exhausted; backup steps in |
| **No deploys on Friday after 4pm** | Reduces weekend pages |

## Escalation chain — documented

```
Primary on-call (page) → Backup on-call (page after 5 min if no ack) → Engineering manager → CTO/VP
```

Each level has a clear handoff: how long before the next level is paged, how that happens (PagerDuty escalation policy, manual escalation).

## When to actually wake someone

| Severity | Wake-up policy |
|---|---|
| SEV-1 | Wake the on-call. Page the backup if no ack in 5 min. Wake the engineering manager. |
| SEV-2 | Wake the on-call. Backup wakes if user impact crosses N min. |
| SEV-3 | Page during business hours only. Slack ping otherwise. |
| SEV-4 | Ticket for next-day handling. No paging. |

A SEV-3 that wakes someone at 3am is a misclassification — fix the severity, not the rotation.

## Handoff cadence

- **End of each on-call week**: written handoff per template
- **Daily standup during week**: brief sync on what happened
- **End of incident**: outgoing IC updates handoff doc immediately

## Anti-patterns

- ❌ Verbal handoff only ("call me with questions") — incoming can't reconstruct
- ❌ Handoff written hours after sign-off (context decays)
- ❌ No backup; primary is sole pageable person (one sick week = no coverage)
- ❌ Pages aggregated weekly without analysis ("we got 12 pages — normal")
- ❌ Same on-call for months because "everyone else doesn't know the system" (knowledge silo + burnout)
- ❌ Calling someone "the on-call" implies they own all reliability; spread the work
- ❌ Page noise (10+ pages a night, mostly false) — fix the alerts, not the people

## Gate criteria

- Written handoff exists for every rotation change, following the template
- Rotation length is ≤ 1 week per shift (or paired primary+backup if longer)
- Pager-tax baseline measured; rotations exceeding 1 paged-page-per-night trigger an alert-review
- Escalation policy documented and operational (test it quarterly)
- New on-call engineers shadow for at least one rotation before being primary
