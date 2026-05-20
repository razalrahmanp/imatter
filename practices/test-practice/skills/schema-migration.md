# schema-migration — Database Migration Pattern

## Pattern Summary

Every migration file follows this naming and structure. Never alter outside a migration.

```sql
-- migrations/0042_add_order_events.sql
-- Up
BEGIN;

CREATE TABLE order_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid NOT NULL REFERENCES branches(id),
  order_id    uuid NOT NULL REFERENCES orders(id),
  event_type  text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

-- RLS: required on every new table
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_events_branch_isolation ON order_events
  USING (branch_id = current_setting('app.branch_id')::uuid);

-- Indexes: (branch_id, created_at DESC) on every tenant table
CREATE INDEX order_events_branch_created ON order_events (branch_id, created_at DESC);
-- Add domain-specific indexes only if queries are known at migration time
CREATE INDEX order_events_order_id ON order_events (order_id);

COMMIT;

-- Down (always include — must be reversible)
-- DROP TABLE IF EXISTS order_events;
```

**Naming convention:** `{sequence}_{verb}_{noun}.sql`
- Verb: `add`, `alter`, `drop`, `rename`, `create`
- Sequence: 4-digit zero-padded integer, monotonically increasing

## Full Reference

### Column type changes — require explicit approval
```sql
-- NEVER: changes type in-place, locks table on large datasets
ALTER TABLE orders ALTER COLUMN total TYPE numeric(12,2);

-- CORRECT: shadow column migration (add → backfill → swap → drop old)
ALTER TABLE orders ADD COLUMN total_v2 numeric(12,2);
-- backfill in batches — never UPDATE without WHERE + LIMIT
UPDATE orders SET total_v2 = total::numeric(12,2) WHERE id > $cursor LIMIT 1000;
-- After backfill verified: swap NOT NULL + default, rename in next migration
```

### Partition strategy — for high-volume tables (>10M rows/year)
```sql
-- Partition by range on created_at — decide at table creation, not after
CREATE TABLE events (
  id         uuid NOT NULL,
  branch_id  uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_q1 PARTITION OF events
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
```

### Rules
- Every new table: `ENABLE ROW LEVEL SECURITY` + branch isolation policy
- Every tenant table: `branch_id uuid NOT NULL REFERENCES branches(id)` + index on `(branch_id, created_at DESC)`
- No `ALTER TABLE ... DROP COLUMN` without a deprecation period (add column, stop writing, then drop in separate migration)
- Migrations run by CI — never run manually against production
- Never modify a committed migration file — add a new one
