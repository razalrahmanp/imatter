---
name: sdlc-postgres-partition
description: Use when a Postgres table grows large enough that index size and vacuum cost become problematic (typically 100M+ rows or time-series workloads) — covers partition-by-range, attachment, and the maintenance patterns.
---

## When to use

- Tables expected to grow > 100M rows
- Time-series data (events, logs, metrics) — partition by created_at
- Data with clear lifecycle (drop old data) — partition lets you DROP a partition instead of DELETE
- Hot/cold patterns where recent data is hit often, old data rarely

## Rule

Partition the table by a key with high cardinality and natural cutoffs (date, tenant, range). Use range partitioning by date as the default. Pre-create partitions before they're needed. Drop old partitions instead of running giant DELETEs.

## Pattern — partition by month

```sql
CREATE TABLE events (
  id         UUID NOT NULL,
  tenant_id  UUID NOT NULL,
  type       TEXT NOT NULL,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
) PARTITION BY RANGE (created_at);

-- Partitions per month
CREATE TABLE events_2026_05 PARTITION OF events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE events_2026_06 PARTITION OF events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

Indexes on the parent table are inherited by all partitions (Postgres 11+).

## Pre-create partitions

Don't wait for inserts to fail. Run a cron/scheduled job that creates the next N partitions ahead of time:

```sql
-- Run weekly: ensure 3 future months exist
CREATE TABLE IF NOT EXISTS events_2026_08 PARTITION OF events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
```

Tools: `pg_partman` automates this; or hand-rolled cron.

## Drop old partitions instead of DELETE

```sql
-- Instead of: DELETE FROM events WHERE created_at < '2024-01-01' (slow, vacuum churn)
ALTER TABLE events DETACH PARTITION events_2023_12;
DROP TABLE events_2023_12;
```

DROP is instant. DETACH lets you archive first if needed.

## Constraints and gotchas

- **No UNIQUE across partitions** unless the unique columns include the partition key. Plan around this.
- **Foreign keys to a partitioned table**: pre-Postgres 12 = no go; PG12+ = works but with caveats.
- **Cross-partition queries**: planner can prune partitions if the query has the partition key in WHERE.
- **Default partition**: catches rows outside ranges — handy but a sign of bad data if it fills.

## Anti-patterns

- ❌ Partitioning a small table (< 10M rows) — adds complexity, no benefit
- ❌ Partition key not in most queries (no pruning happens; planner scans all)
- ❌ Forgetting to pre-create partitions (insert fails when month rolls over)
- ❌ One partition per day on a 5-year-old table (10000+ partitions = planner overhead)
- ❌ DELETE-ing data instead of dropping partitions
- ❌ Indexes per partition without an on-parent index (drift; missed indexes on new partitions)

## Gate criteria

- Partitioning chosen for a documented reason (size, retention, hot/cold)
- Pre-create script in place (cron / pg_partman)
- Drop policy documented and automated
- Queries include the partition key in WHERE where possible
- Indexes defined on the parent table (inherited to partitions)
- A monthly check verifies next partition exists
