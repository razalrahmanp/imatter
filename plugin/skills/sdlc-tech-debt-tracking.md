---
name: sdlc-tech-debt-tracking
description: Use when noticing technical debt during feature work or after an incident — captures it in a place that won't get forgotten, with enough context to act on later.
---

## Rule

Tech debt that lives only in heads gets forgotten. Tech debt with a row in a tracker but no context can't be triaged. Capture every piece of debt in a single tracking place, with what it is, why it's a problem, and what fixing it would unlock.

## Where to track

| Option | Pros | Cons |
|---|---|---|
| **Section 16 (Open Items) of `SDLC_VALIDATION.md`** | Lives with the code, version-controlled | Less discoverable for a wider org |
| **GitHub Issues with label `tech-debt`** | Discoverable, queryable | Drifts if not curated |
| **Dedicated `docs/tech-debt.md`** | Single source for the team | Manual upkeep |
| **TODO comments in code** | Inline context | Hard to query across codebase |

For this plugin's projects: log in Section 16 (Open Items) via `log_open_item`. The MCP tool keeps the entry searchable and dated.

## The four fields every entry needs

```
Title:       <one-line summary>
Discovered:  <date and how>
Impact:      <what it costs us today>
Fix:         <what would solve it; rough effort>
Trigger:     <what would force us to fix>
```

Example:

```
Title:       Order-status enum drifts between API and worker
Discovered:  2026-04-12, during payment-failure incident
Impact:      Workers silently skip orders in unexpected states; happened twice in March
Fix:         Move enum to a shared package; type-check on import. ~1 day work
Trigger:     Before adding any new order state (we're about to add `partially_refunded`)
```

The "Trigger" field is what separates debt-with-a-plan from debt-that-rots. Without a trigger, items sit forever.

## Categories of debt

| Type | Examples |
|---|---|
| **Code smell** | Duplicated logic, long file, unclear name |
| **Dead code** | Unused function, unreachable branch |
| **Outdated dependency** | Library 2+ majors behind |
| **Test gap** | Critical path with no test coverage |
| **Documentation gap** | Behavior not documented, runbook missing |
| **Configuration drift** | Different teams running different configs |
| **Architectural** | Wrong boundary between services |
| **Performance** | Known slow path not yet optimized |

Different types warrant different fixes — a long file (~1 hour) is not the same as an architectural boundary (~weeks).

## Prioritization signals

Promote an item when:

- It blocks a current piece of work (already discovered)
- It contributed to a recent incident
- It's a recurring source of confusion (multiple team members hit it)
- Its trigger has fired (new state being added; new team joining; tier-up planned)
- The blast radius is growing (more code depends on the brittle thing every week)

## Anti-patterns

- ❌ A 200-item backlog nobody looks at
- ❌ TODO comments with no context ("// TODO: fix this") — useless six months later
- ❌ "We should refactor X" with no trigger or impact — never acted on
- ❌ Tech-debt items that are actually feature requests in disguise
- ❌ One person hoards debt knowledge ("only Alice knows what's broken")
- ❌ Tech-debt sprint that fixes 1% of the backlog with no measurable impact
- ❌ Quarterly tech-debt budget that goes unused because no items are ready

## Gate criteria

- A canonical tech-debt tracker exists (Section 16 of SDLC_VALIDATION.md, or labeled issues)
- Every entry has impact, fix, and trigger fields
- The tracker is reviewed at least monthly
- Items have visible age — items older than 6 months get reconsidered (close as won't-fix, or promote)
- A portion of each sprint / cycle is allocated to debt with clear acceptance criteria
