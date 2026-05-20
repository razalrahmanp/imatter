---
name: sdlc-postmortem-blameless
description: Use when writing a post-incident review — covers the blameless format, what to capture, and how to produce action items that actually get done.
---

## Rule

A post-mortem documents what happened, why, and what changes prevent recurrence. It is *blameless*: assume everyone acted reasonably given what they knew. Find systemic causes (process, knowledge, tooling), not individual fault.

## The template

```markdown
# Post-mortem: <short title>

**Date of incident:** YYYY-MM-DD
**Duration:** <time the user impact lasted>
**Severity:** SEV-N
**Authors:** <names — usually IC + TL>
**Date of post-mortem:** YYYY-MM-DD

## TL;DR
<2–3 sentences. What happened, how bad, what we changed.>

## Impact
- User-facing impact: <what users experienced>
- Duration: <start time to end time, with time zones>
- Affected users / tenants: <count or scope>
- Revenue / data impact: <if applicable>

## Timeline
<Detailed timeline in UTC. Every meaningful action and observation. Scribe wrote this during the incident; clean up here.>

| Time (UTC) | Event |
|---|---|
| 14:03 | First user reports 500 errors on /checkout |
| 14:05 | Alert fires for checkout-api error rate > 5% |
| 14:07 | On-call ack; opens incident channel |
| 14:09 | IC declared; status page updated to "Investigating" |
| 14:11 | TL identifies recent deploy as suspect cause |
| 14:14 | Rollback initiated |
| 14:17 | Error rate returning to baseline; user reports stop |
| 14:20 | Status page → "Resolved" |
| 14:30 | Incident closed; post-mortem scheduled |

## Root cause
<The technical chain of events. Be precise. "X caused Y caused Z." Distinguish proximate from contributing.>

## Contributing factors
<Things that turned a small bug into an incident. Process gaps, monitoring gaps, knowledge gaps.>

## What went well
<Things that worked. Detection time, rollback worked, calm communication. This isn't padding — these are practices to preserve.>

## What went poorly
<Detection too slow, runbook missing, rollback was tricky, comm to customers delayed.>

## Where we got lucky
<Things that could have been worse but weren't. The DB was the only thing affected, not auth too. Identifying these primes the team for similar near-misses.>

## Action items

| # | Action | Owner | Due | Issue |
|---|---|---|---|---|
| 1 | Add alert for X | @alice | 2026-05-30 | #1234 |
| 2 | Write runbook for Y | @bob | 2026-06-05 | #1235 |
| 3 | Add integration test for Z | @carol | 2026-05-25 | #1236 |

Each action item must have: an owner (single name), a due date, and a tracked issue. Items without these never get done.

## Lessons learned
<1–3 paragraphs of takeaway. Not "we'll do better" — specific operating principles.>
```

## Blameless language

Replace causation about people with causation about systems.

| Don't write | Write instead |
|---|---|
| "Bob deployed at 4pm Friday without testing" | "Our deploy process allowed an untested change to reach production at end-of-week" |
| "Alice didn't check the dashboard" | "Our paging didn't escalate when the first alert was missed" |
| "Carol forgot to run migrations" | "Our deploy script doesn't verify migrations ran before promoting" |

Each rephrasing points at a *system* that can be fixed. Naming individuals points at a person who can't.

## Action items that actually get done

- One owner per item (not "the team" — that's nobody)
- Due date within 30 days for medium-severity, within 1 week for high
- Tracked in the issue tracker, not just the post-mortem doc
- Reviewed at the next post-mortem ("what about last quarter's items?")

## Distribution

- Internal: every engineer can read every post-mortem (no gatekeeping)
- Customer-facing if SEV-1 with public impact: edited version on the status page or blog
- Optional industry-standard: contribute to projects like postmortemdb if it teaches others

## Anti-patterns

- ❌ "Bob will be more careful" as an action item (not actionable, not blameless)
- ❌ Action items with no owner ("the team will...")
- ❌ No timeline (memory fades; reconstruct accurately while fresh)
- ❌ Skipping "what went well" (the team loses motivation if every retro is failure-focused)
- ❌ Post-mortem written by one person without IC/TL input
- ❌ Action items not tracked anywhere (lost; same incident recurs)
- ❌ Public-facing version that minimizes ("brief intermittent issue") — be honest
- ❌ Skipping post-mortem for SEV-2 (most learning is here, not in SEV-1s)

## Gate criteria

- Every SEV-1 and SEV-2 gets a post-mortem within 5 business days
- Post-mortems follow the standard template
- Action items have owner + due + issue link
- Post-mortems are linked from the team docs and discoverable
- Quarterly review checks which prior action items got done; unfinished ones get escalated
- "What went well" section is always present
