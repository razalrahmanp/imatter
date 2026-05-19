# Drill 4 — SQL: Sessionization

## What this drill covers

Assigning events to sessions based on a timeout boundary — grouping user activity where any gap longer than N minutes starts a new session.

## Core concepts

- `LAG()` to compute time since the previous event for the same user
- Session boundary flag: `CASE WHEN gap > threshold THEN 1 ELSE 0 END`
- `SUM(flag) OVER (PARTITION BY user ORDER BY ts)` — cumulative sum of flags produces a session ID
- Aggregating sessions: session start, end, duration, event count

## Problem shapes to expect

- "Assign each page-view event to a session, where 30 minutes of inactivity ends a session."
- "Count the number of sessions per user per day."
- "Find the average session duration."

## What interviewers probe

- Can you handle the first event per user (no previous event — `LAG` returns NULL)?
- Can you write the full pipeline from raw events to session-level aggregates in one query?
- Can you explain why the cumulative sum of boundary flags correctly increments the session ID?

## Interview context

HackerRank, hard. This is gap-and-island thinking applied to time series. The insight is the same — use the cumulative sum of a flag as a group key.

## How to use SDLC_VALIDATION.md

Build a small test dataset (a few users, a mix of short and long gaps) and validate your query against it. Document the threshold decision in Section 15 of `SDLC_VALIDATION.md`.
