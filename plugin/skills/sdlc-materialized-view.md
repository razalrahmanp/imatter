---
name: sdlc-materialized-view
description: Use when aggregating expensive queries (dashboards, reports, leaderboards) — covers when MVs make sense vs other options, refresh strategies, and the staleness tradeoff.
---

## When to use

- A read query that's slow (seconds) and runs often
- The freshness requirement is "minutes" not "real-time"
- The aggregation is expensive enough that caching the result helps

Don't use for:
- Single-row lookups by index (just index it)
- Data that needs to be real-time
- Aggregations cheap enough to compute on the fly

## Pattern

```sql
CREATE MATERIALIZED VIEW order_summary_by_tenant AS
SELECT
  tenant_id,
  date_trunc('day', created_at) AS day,
  COUNT(*) AS order_count,
  SUM(total_paise) AS revenue_paise
FROM orders
WHERE status = 'paid'
GROUP BY tenant_id, date_trunc('day', created_at);

CREATE UNIQUE INDEX ON order_summary_by_tenant (tenant_id, day);  -- enables CONCURRENTLY refresh
```

The UNIQUE index is required for `REFRESH CONCURRENTLY` (non-blocking refresh).

## Refresh

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY order_summary_by_tenant;
```

- `CONCURRENTLY`: doesn't block reads; takes longer
- Without: blocks reads during refresh; faster

Schedule with cron / pg_cron / a worker. Typical cadence: 5–15 minutes for dashboards, hourly for reports.

## Incremental refresh — Postgres doesn't have this natively

If the data is large, full refresh gets expensive. Options:

1. **pg_ivm extension** — incremental MV refresh
2. **Hand-rolled** — own aggregation table + triggers / change-data-capture
3. **Tools** — Materialize, ksqlDB (streaming materializations)

For most internal dashboards: full `REFRESH CONCURRENTLY` every 10 min is good enough until it isn't.

## MV vs other options

| Option | When |
|---|---|
| **Index** | Filter/lookup on a column; cheaper than MV |
| **Regular view** | Just abstraction over a query; not pre-computed |
| **Materialized view** | Expensive aggregation; minutes-stale acceptable |
| **Cache (Redis)** | Sub-minute freshness; key-value access pattern |
| **Read replica** | Heavy read load on top of OLTP |
| **Data warehouse** | Multi-second queries that need columnar storage; ETL'd from OLTP |

If the underlying query takes 10s+: think MV. If 100ms+: probably an indexing problem.

## Anti-patterns

- ❌ Refreshing every minute on data that's only useful daily
- ❌ Refresh without `CONCURRENTLY` on a production query (blocks readers)
- ❌ MV without an index on the joined/filtered columns
- ❌ Cascading MVs (MV-of-MV — staleness compounds)
- ❌ Treating MV as real-time (always min-stale by definition)
- ❌ No monitoring of refresh duration — slow drift goes unnoticed
- ❌ Refresh runs in the user request path (always async)

## Gate criteria

- MV chosen for documented reason (query latency, frequency)
- Refresh uses `CONCURRENTLY` with unique index
- Refresh schedule documented; cadence matches freshness need
- Refresh runs async, not in user request path
- Refresh duration is monitored (alarm if grows past threshold)
- A runbook entry covers "MV stale" — manual refresh, root-cause check
