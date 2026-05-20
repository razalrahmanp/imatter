---
id: schema-migration
title: "Schema migration — naming, RLS on every table, rollback safety"
layer: stack
stack: react-supabase-lambda
tags: [postgresql, database, migration, rls, schema]
applies_to:
  task_types: [add-migration, add-table, modify-schema, add-column]
  stages: [7]
size_tokens: 220
related: [supabase-rls, rds-query]
---

# schema-migration — Database Migration Pattern

## Pattern Summary

Every migration file follows this naming and structure. Never alter schema outside a migration.

```sql
-- migrations/0042_add_order_events.sql
BEGIN;

CREATE TABLE order_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid NOT NULL REFERENCES branches(id),
  order_id    uuid NOT NULL REFERENCES orders(id),
  event_type  text NOT NULL,
  payload     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY order_events_branch_isolation ON order_events
  USING (branch_id = current_setting('app.branch_id')::uuid);

CREATE INDEX order_events_branch_created ON order_events(branch_id, created_at DESC);

COMMIT;

-- Down (always include — must be reversible)
-- DROP TABLE IF EXISTS order_events;
```

**Naming convention:** `{4-digit-sequence}_{verb}_{noun}.sql`
- Sequence: monotonically increasing, zero-padded
- Verb: `add`, `alter`, `drop`, `rename`, `create`

**Every tenant table requires:**
1. `branch_id uuid NOT NULL REFERENCES branches(id)`
2. `ENABLE ROW LEVEL SECURITY`
3. Branch isolation policy
4. Index on `(branch_id, created_at DESC)`

## Full Reference

### Column type changes — shadow column pattern
Never `ALTER COLUMN ... TYPE` on a live table. Instead: add shadow column → backfill in batches → swap → drop old in next migration.

### Partition strategy (tables > 10M rows/year)
Decide at creation time — partitioning after the fact requires a table rebuild.

### Rules
- Never modify a committed migration file — add a new one
- Always include a `-- Down` comment for rollback reference
- Migrations run by CI — never manually against production
