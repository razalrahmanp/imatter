# Drill 9 — Python: Transform, Aggregate, and Reconcile Two Sources

## What this drill covers

Taking data from two sources, transforming each to a common shape, joining or reconciling them, and producing a diff or merged output — a core data engineering task in Python without a DataFrame library.

## Core concepts

- Keyed aggregation with `collections.defaultdict` or a plain dict
- Two-source reconciliation: build a dict from source A, iterate source B, compare
- Computing counts, sums, and averages per key in a single pass
- Identifying rows only in A, only in B, and in both (a set-operation join)
- Producing a structured diff output

## Problem shapes to expect

- "Given yesterday's user table and today's, find all new users, deleted users, and changed records."
- "Reconcile a CSV of expected transactions against a JSON API response; report discrepancies."
- "Group events by user and compute total spend per user from a log stream."

## What interviewers probe

- Do you build the lookup dict from the smaller source (memory efficiency)?
- Is your aggregation a single pass over the data, or multiple?
- Can you produce output that clearly separates inserts, updates, and deletes?
- Do you handle the case where a key exists in one source but not the other?

## Interview context

Python round, medium to hard. This tests whether you think in terms of keyed lookups and set operations, not nested loops.

## How to use SDLC_VALIDATION.md

Create two small sample input files (e.g., `source_a.json` and `source_b.json`). Write `solution.py` to reconcile them. Confirm the diff output is correct. Log the join-key decision in Section 15 of `SDLC_VALIDATION.md`.
