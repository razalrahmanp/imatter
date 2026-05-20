---
id: decision-record
title: "Decision record — ADR format, when to write, what to include"
layer: practice
tags: [adr, architecture, decision, documentation, rationale]
applies_to:
  task_types: [any]
  stages: [1, 2, 3, 5]
size_tokens: 190
related: [architecture-doc, tech-debt-tracking, sdlc-gate]
---

# decision-record — Architecture Decision Record Pattern

## Pattern Summary

Write a decision record when a significant choice is made that future developers might question or reverse without context. The record preserves the WHY, not just the WHAT.

**When to write an ADR:**
```
YES — write an ADR when:
  • Choosing a technology, library, or framework
  • Making a structural/architectural trade-off (sync vs async, monolith vs service)
  • Deciding to NOT do something that seems obviously good
  • Overriding a previous decision
  • Choosing between two viable approaches with real trade-offs

NO — skip the ADR when:
  • The decision is obvious given the existing stack
  • It can be reversed in < 1 hour with no migration cost
  • It's a style/naming preference (use code review for those)
```

**ADR format (minimal — fits in SDLC Section 14):**
```markdown
## ADR-<N>: <short title>

**Date:** YYYY-MM-DD
**Status:** Proposed | Accepted | Superseded by ADR-<M>

**Context:**
What problem were we solving? What constraints existed?

**Decision:**
What did we decide to do?

**Consequences:**
What becomes easier? What becomes harder? What do we accept?

**Alternatives considered:**
What else did we look at and why did we reject it?
```

## Full Reference

### ADR numbering
Sequential integers scoped to the project (ADR-001, ADR-002...). Never reuse a number — supersede instead. Store in `docs/decisions/` or in SDLC Section 14.

### Superseding a decision
When reversing a previous ADR: write a new ADR that references the old one. Update the old ADR status to "Superseded by ADR-N." Do not delete the old ADR — the history of WHY the original choice was made is still valuable.

### SDLC integration
Every significant decision logged in SDLC Section 14 during development should become an ADR. The SDLC log is session-scoped; ADRs are permanent project artifacts.
