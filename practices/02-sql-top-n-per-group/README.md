# Drill 2 — SQL: Top-N per Group

## What this drill covers

Selecting the top N rows within each group — the single most common window-function interview pattern.

## Core concepts

- `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` — assign a rank within each group
- `RANK()` vs `DENSE_RANK()` vs `ROW_NUMBER()` — understand the difference and when each is correct
- Filtering to top-N by wrapping in a subquery or CTE: `WHERE rn <= N`
- Handling ties: when you want exactly N rows vs. all rows tied at position N

## Problem shapes to expect

- "Find the top 3 products by revenue in each category."
- "Return the most recent order for each customer."
- "Get the second-highest salary in each department."

## What interviewers probe

- Do you use `ROW_NUMBER` when ties must be broken, or `RANK`/`DENSE_RANK` when ties should be preserved?
- Can you explain what `RANK` returns when there is a tie at position 1? (It skips 2.)
- Can you write the CTE form cleanly vs. a subquery form?

## Interview context

HackerRank, medium to hard. Ties are the trap — know which function gives which behavior before the interview.

## How to use SDLC_VALIDATION.md

Start a Claude session in this folder and follow the SDLC gate sequence. Commit solved problems. Log any pattern decisions in Section 15 of `SDLC_VALIDATION.md`.
