# Drill 1 — SQL: Running Totals

## What this drill covers

Window function fundamentals anchored on cumulative aggregation: computing a running sum, running count, or running average over an ordered partition.

## Core concepts

- `SUM(...) OVER (PARTITION BY ... ORDER BY ...)` — basic cumulative sum
- `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — explicit frame clause
- Combining partitions (per-user, per-category) with a time-ordered running total
- Running totals that reset per group vs. global running totals

## Problem shapes to expect

- "Show each order and the cumulative revenue for that customer up to and including that order."
- "For each day, show the daily sales and the month-to-date total."
- "Compute a 7-day rolling average of active users."

## What interviewers probe

- Can you write the frame clause from memory, or do you guess?
- Do you understand what happens to NULLs in the aggregation?
- Can you produce a rolling (bounded) window vs. a running (unbounded) total?

## Interview context

HackerRank-style, medium difficulty. This is the foundation for every other window-function problem. Get it cold.

## How to use SDLC_VALIDATION.md

Copy the prompt from `README.md` at the repo root (the usage guide) and start a Claude session anchored to the `SDLC_VALIDATION.md` in this folder. Work through practice problems, commit your solutions, and track decisions in Section 15 of the validation doc.
