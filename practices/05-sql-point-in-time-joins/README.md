# Drill 5 — SQL: Point-in-Time Joins

## What this drill covers

Joining a fact table to the version of a dimension that was current at the time of each fact — the "as-of" join, also called a slowly-changing-dimension lookup or a temporal join.

## Core concepts

- The pattern: for each fact row at time T, find the dimension row where `valid_from <= T AND (valid_to > T OR valid_to IS NULL)`
- Using `MAX(valid_from) ... WHERE valid_from <= fact.ts` as an alternative to explicit validity ranges
- `LATERAL JOIN` / `APPLY` to express the lookup cleanly in supported dialects
- Handling gaps in dimension history (no row covers a period)

## Problem shapes to expect

- "Join each transaction to the product price that was in effect on the transaction date."
- "Show each user's subscription tier at the time of their purchase."
- "Find the exchange rate on the day each order was placed."

## What interviewers probe

- Do you understand why a regular join is wrong when a dimension changes over time?
- Can you handle the case where a fact precedes all dimension records?
- Can you handle overlapping validity ranges (a data-quality issue)?

## Interview context

HackerRank, hard. This pattern appears in financial systems, pricing engines, and any slowly-changing dimension. Know both the range-overlap form and the MAX-subquery form.

## How to use SDLC_VALIDATION.md

Create sample data with at least one dimension change mid-period. Verify your query returns the correct historical value, not the current one. Log the pattern choice in Section 15 of `SDLC_VALIDATION.md`.
