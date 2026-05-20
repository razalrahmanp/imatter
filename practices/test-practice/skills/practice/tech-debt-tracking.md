---
id: tech-debt-tracking
title: "Tech debt tracking — log, classify, prioritise — don't fix silently"
layer: practice
tags: [tech-debt, tracking, backlog, todo, maintenance]
applies_to:
  task_types: [any]
  stages: [5, 7, 10]
size_tokens: 185
related: [decision-record, refactoring-safety, code-review-checklist]
---

# tech-debt-tracking — Tech Debt Tracking Pattern

## Pattern Summary

Tech debt noticed during a task gets logged, not fixed silently. Silent fixes expand scope unpredictably. Logged debt can be scheduled, prioritised, and discussed.

**Where to log:**
```
In-code:   // TODO(#<issue-number>): short description — links debt to a trackable issue
SDLC file: Section 15 (Open Items) — for session-level tracking during development
Backlog:   A real ticket in your issue tracker — for debt that needs scheduling
```

**Never log debt without a ticket number:**
```typescript
// Bad — unlinked, will never be fixed
// TODO: fix this later

// Good — linked to a trackable issue
// TODO(#342): replace manual pagination with cursor-based; this breaks at >10k rows
```

**Debt classification:**
```
Critical  — causes data loss, security risk, or production incidents. Fix in current sprint.
High      — causes frequent slowdowns or developer friction. Schedule in next sprint.
Medium    — suboptimal but stable. Schedule when working in the area.
Low       — cosmetic, naming, minor structure. Fix opportunistically during related work.
```

**Debt record template (for the issue tracker):**
```
Title:    [DEBT] Pagination breaks at >10k rows in order history endpoint
Location: src/functions/orders/history.ts:47
Why debt: Used offset pagination for speed; cursor-based was out of scope for the sprint
Impact:   High — query time degrades linearly; at 50k rows it times out
Fix:      Switch to keyset pagination using (created_at, id) cursor
Effort:   ~4h
```

## Full Reference

### SDLC Section 15 vs backlog
Section 15 is for items noticed during the current session — a temporary buffer. Before closing a session, move debt worth tracking to the issue tracker and reference the ticket number in Section 15. Don't let Section 15 become a permanent backlog.

### Debt review cadence
Review and groom debt backlog at the start of each sprint. Classify any new items. Close any that were fixed incidentally.
