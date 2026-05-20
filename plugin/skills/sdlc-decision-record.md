---
name: sdlc-decision-record
description: Use when making any significant architectural, technical, or process decision — captures the choice and the reasoning so future readers (and you) can revisit without re-deriving it.
---

## Rule

Significant decisions are recorded. A decision record states what was decided, the context that drove it, the alternatives considered, and the consequences accepted. It is immutable once logged; if circumstances change, write a new record that supersedes the old one.

## What counts as "significant"

Log a decision when it:

- Constrains future work (technology choice, framework, language)
- Has obvious alternatives that you rejected
- Trades off cost vs benefit deliberately
- Would surprise a new contributor who joined later
- Is the kind of thing somebody would ask "why did we do it this way?"

Don't log:
- Local code structure choices (file naming, internal class structure)
- Reversible defaults that anyone can change without coordination
- Decisions made by an explicit policy (e.g. "we always use TypeScript")

When in doubt, log it — small overhead now, big payoff later.

## Format — ADR (Architecture Decision Record) variant

```markdown
# <Number>. <Title>

- **Date**: 2026-05-20
- **Status**: Accepted | Proposed | Superseded by <N> | Deprecated
- **Deciders**: <names or roles>

## Context
<What is the situation that requires a decision? What forces are at play?>

## Decision
<What did we decide? State it clearly in one sentence, then expand.>

## Alternatives considered
- **Option A**: <description>
  - Pros: …
  - Cons: …
  - Why not: <one-liner>
- **Option B**: <description>
  - …

## Consequences
- **Positive**: <what we gain>
- **Negative**: <what we accept as the cost>
- **Risks**: <what could go wrong>

## References
- <link to PR, design doc, related ADR>
```

## Where to store

- `docs/adr/0001-use-postgres.md`, `0002-cognito-multi-pool.md`, etc.
- Numbered sequentially. **Never renumber.**
- Or: Section 15 of `SDLC_VALIDATION.md` (this plugin's convention)

Either way, decisions live in source control, not a wiki that drifts.

## Status lifecycle

```
Proposed → Accepted → (Deprecated | Superseded by <N>)
```

| Status | Meaning |
|---|---|
| **Proposed** | Under discussion; not binding yet |
| **Accepted** | The current decision; default to following it |
| **Deprecated** | No longer relevant; e.g. the system that motivated it is gone |
| **Superseded by <N>** | Replaced by a newer decision; link forward |

A superseded decision is not deleted — readers need the history.

## Example — good ADR

```markdown
# 0007. Use Cognito multi-pool routing instead of single pool

- **Date**: 2026-04-12
- **Status**: Accepted
- **Deciders**: Architecture team

## Context
We have two distinct authentication populations: customers (large volume, self-signup,
social login) and admins (small, internal-only, MFA required). Treating them as one
pool would force the more permissive customer-pool settings on admin accounts.

## Decision
Use two separate Cognito User Pools — `Customers` and `Admins` — and route
verification by the `iss` claim of the incoming JWT.

## Alternatives considered
- **Single pool with groups**: Simpler infra. But admin-specific settings (MFA required,
  session length, password policy) cannot vary by group — they're pool-level. Rejected.
- **Custom JWT issuer**: Full control but loses Cognito's managed signup / OAuth flows.
  Rejected — not worth the maintenance burden.

## Consequences
- **Positive**: Each pool gets settings appropriate to its population. Admin pool can
  enforce MFA without affecting customer experience.
- **Negative**: Every backend that accepts auth must handle both issuers
  (see `sdlc-aws-cognito-multi-pool`). Slight code complexity increase.
- **Risks**: A user could exist in both pools with the same email — we mitigate by
  deciding emails are not unique across pools (admins have separate identifiers).

## References
- PR #1234 (initial wiring)
- Skill: sdlc-aws-cognito-multi-pool
```

## Anti-patterns

- ❌ ADRs written after the fact, post-hoc rationalizing what was already shipped (still useful, but flag as retrospective)
- ❌ Deleting an old ADR because "we don't do that anymore" (mark Superseded instead)
- ❌ Re-using ADR numbers
- ❌ ADRs that are just "we chose X" with no Context or Alternatives (the *thinking* is the value)
- ❌ Living "decisions document" that gets edited — decisions should be immutable; corrections are new records
- ❌ Hiding ADRs in a wiki / Confluence / Notion (they should live with the code)
- ❌ Writing an ADR for every choice (signal lost in noise — log the consequential ones)

## Gate criteria

- An `docs/adr/` directory (or Section 15 of `SDLC_VALIDATION.md`) exists with a numbering scheme
- Every significant technical choice has an ADR (or links to one in the PR description)
- ADRs are immutable; updates are new records that supersede prior ones
- New contributors can read ADRs 1–N in order and understand how the system reached its current shape
- An ADR template is available so format stays consistent
