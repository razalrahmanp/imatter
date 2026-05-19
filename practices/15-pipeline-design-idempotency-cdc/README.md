# Drill 15 — Pipeline Design: Idempotency, Exactly-Once, Watermarking, and CDC

## What this drill covers

The operational correctness guarantees that separate a production-grade pipeline from a fragile one — the concepts a Principal Data Engineer is expected to own and defend on a whiteboard.

## Core concepts

### Idempotency
- A pipeline run is idempotent if running it twice produces the same result as running it once
- Implementation: write to a partition keyed on the run date and `OVERWRITE` it — re-running replaces the partition rather than appending duplicates
- Test: run the job twice with the same input and assert the output is identical

### Exactly-once semantics
- A guarantee that each event is processed and reflected in the output exactly once — not zero times (at-most-once) and not more than once (at-least-once)
- Hard to achieve end-to-end; most streaming systems give at-least-once delivery and rely on idempotent sinks to absorb duplicates
- Common pattern: write with a dedup key in the sink (`INSERT INTO ... ON CONFLICT DO NOTHING` or Delta Lake `MERGE`)

### Watermarking (streaming)
- In a streaming system, event time ≠ processing time — events arrive late
- A watermark is a timestamp threshold: "we believe all events with event_time < watermark have arrived"
- Windows are closed and emitted once the watermark passes the window end
- Trade-off: a tighter watermark = lower latency + more dropped late data; a looser watermark = higher completeness + higher latency

### Change Data Capture (CDC)
- Instead of full-table snapshots, capture only the rows that changed (INSERT / UPDATE / DELETE operations from the source database transaction log)
- Common CDC tools: Debezium (reads Postgres/MySQL binlog), AWS DMS, Fivetran
- CDC output is a stream of change events: `{op: "u", before: {...}, after: {...}}`
- Applying CDC to a sink: `MERGE` (upsert) for inserts and updates; `DELETE` or soft-delete for deletes

### Schema evolution
- Sources change their schemas over time — new columns, renamed columns, type changes
- Strategy options: fail-fast (reject unknown fields), permissive (ignore unknown, pass through), schema registry (enforce a versioned contract)
- Delta Lake / Iceberg handle schema evolution natively with `mergeSchema` option

## Problem shapes to expect

- "Your pipeline runs nightly. A bug caused it to run twice on the same day. What happened?"
- "How do you keep a 500 GB target table in sync with a source database that has 10,000 updates per minute?"
- "What is the difference between at-least-once and exactly-once, and when does it matter?"
- "A source started adding a new column. How does your pipeline handle it?"

## What interviewers probe

- Can you define idempotency precisely and give an implementation example?
- Do you know what a watermark is and why you need one?
- Can you explain CDC vs full snapshots and when you would choose each?
- Can you describe exactly-once semantics and acknowledge that it is hard to achieve?

## Interview context

Whiteboard, highest Principal signal. These are the concepts that distinguish a data engineer who has operated production pipelines from one who has only written them. Be specific — "we use partition overwrite for idempotency" beats "we handle duplicates."

## How to use SDLC_VALIDATION.md

Write an `architecture.md` describing a CDC pipeline from a source database to a data warehouse. Cover idempotency, late-data handling, and schema evolution. Log every design decision in Section 15 of `SDLC_VALIDATION.md`.
