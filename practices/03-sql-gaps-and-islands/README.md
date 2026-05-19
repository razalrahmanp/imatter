# Drill 3 — SQL: Gaps and Islands

## What this drill covers

Identifying consecutive sequences ("islands") and the breaks between them ("gaps") in a dataset — a classic interview pattern that requires layering window functions.

## Core concepts

- The island technique: `ROW_NUMBER()` subtracted from a sequential value produces a constant for each island
- `LAG()` / `LEAD()` to detect the boundary between a gap and an island
- Grouping islands with `MIN` / `MAX` to find start and end of each sequence
- Date-based gaps: days with no activity, sessions with inactivity breaks

## Problem shapes to expect

- "Find all date ranges where a user was continuously active (no day missed)."
- "Given a table of server availability flags, find each downtime window."
- "Group consecutive order IDs that belong to the same batch."

## What interviewers probe

- Can you derive the island key without a hint?
- What happens when the sequence has duplicates?
- Can you express the result as `(island_start, island_end)` date ranges?

## Interview context

HackerRank, hard. The `ROW_NUMBER() - sequence` trick is the key insight — once you have it, the rest is a standard group-by.

## How to use SDLC_VALIDATION.md

Use this folder as a practice workspace. Write each solution in a `.sql` file, commit it, and log the approach decision in Section 15 of `SDLC_VALIDATION.md`.
