# Drill 6 — SQL: Deduplication

## What this drill covers

Removing or identifying duplicate rows, retaining exactly one representative row per logical entity — a constant data engineering task.

## Core concepts

- `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)` to rank duplicates and keep `rn = 1`
- Choosing the correct ordering for "keep the latest", "keep the earliest", "keep the most complete"
- `DISTINCT` vs window-function dedup — when each is appropriate
- Dedup on partial keys: what to do when the uniqueness constraint is on a subset of columns

## Problem shapes to expect

- "This events table has duplicates due to a reprocessing bug. Keep only the latest record per `event_id`."
- "De-duplicate customers where the same email appears multiple times; keep the oldest account."
- "Find all rows that are duplicates but do not remove them — just flag them."

## What interviewers probe

- Can you articulate the difference between `DISTINCT` (exact-row equality) and window-function dedup (keep one per key)?
- What happens if two duplicate rows have the same timestamp — which one is kept by `ROW_NUMBER`?
- Can you write a DELETE using the dedup logic (not just a SELECT)?

## Interview context

HackerRank, medium. Dedup is a daily data engineering task. The trap is choosing the wrong ordering column, producing non-deterministic results.

## How to use SDLC_VALIDATION.md

Write the dedup query and also its DELETE form. Test with an edge case where all candidate columns are equal. Log the tie-breaking decision in Section 15 of `SDLC_VALIDATION.md`.
