# Drill 7 — SQL: Window Function Edge Cases

## What this drill covers

The traps that separate a correct answer from a wrong one: ties, NULLs in window frames, divide-by-zero in window expressions, and anchoring windows to a fixed reference date instead of the moving current row.

## Core concepts

### Ties
- `RANK` vs `DENSE_RANK` vs `ROW_NUMBER` — tie behavior for each
- When a tie in the ORDER BY clause causes non-determinism in `ROW_NUMBER`
- Using a tiebreaker column to make ordering deterministic

### NULL handling
- NULLs in `ORDER BY` within a window: `NULLS FIRST` / `NULLS LAST`
- NULLs propagate through `SUM`, `AVG` — `COUNT(col)` ignores NULLs but `COUNT(*)` does not
- `IGNORE NULLS` in `LAST_VALUE` / `FIRST_VALUE` (supported in some dialects)

### Divide-by-zero
- `NULLIF(denominator, 0)` to safely guard division in a window expression
- `CASE WHEN denominator = 0 THEN NULL ELSE numerator / denominator END`

### Fixed-date vs. moving-now windows
- Hard-coding `WHERE event_date >= '2024-01-01'` locks the window to a historical point
- Using `WHERE event_date >= CURRENT_DATE - INTERVAL '30 days'` moves with time
- Interview questions sometimes intentionally use a fixed past date — know when that is a deliberate constraint vs. a bug

## Problem shapes to expect

- "What is the win rate per player? Handle players with zero games."
- "Return the most recent non-null value for each user's status."
- "Rank products by revenue; two products at the same revenue should share the same rank."

## Interview context

HackerRank, hard. These are the correctness traps. A solution that works on clean data but fails on NULLs, ties, or zeros will be flagged immediately in a Principal-level interview.

## How to use SDLC_VALIDATION.md

Build test cases that specifically exercise each trap: a tie, a NULL in the frame, a zero denominator. Confirm your query handles all of them. Document the NULL strategy in Section 15 of `SDLC_VALIDATION.md`.
