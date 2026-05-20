---
id: supabase-migration
title: "Supabase migration — sqitch-style versioned SQL, RLS policy updates"
layer: stack
stack: react-supabase-lambda
tags: [supabase, migration, sql, rls, schema, postgres]
applies_to:
  task_types: [schema-migration, add-table, modify-table]
  stages: [4, 5]
size_tokens: 210
related: [supabase-rls, rds-query, schema-migration]
---

# supabase-migration — Supabase Migration Pattern

## Pattern Summary

Migrations are sequential, versioned SQL files. Each migration is a single logical change. Never edit a migration once it has been applied to any environment.

**Migration file naming:**
```
supabase/migrations/
  20260520_001_create_orders.sql
  20260520_002_add_orders_rls.sql
  20260521_001_add_order_items_index.sql

Format: YYYYMMDD_NNN_<description>.sql
```

**Migration file template:**
```sql
-- 20260520_001_create_orders.sql
-- Description: Create orders table with RLS isolation

BEGIN;

CREATE TABLE orders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    uuid NOT NULL REFERENCES branches(id),
  table_id     uuid NOT NULL REFERENCES tables(id),
  status       text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','ready','closed','cancelled')),
  total_paise  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- RLS: rows are visible only to the branch that owns them
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_branch_isolation ON orders
  USING (branch_id = current_setting('app.branch_id')::uuid);

-- Index for branch-scoped queries
CREATE INDEX orders_branch_id_created_at ON orders (branch_id, created_at DESC);

COMMIT;
```

**RLS policy update pattern:**
```sql
-- To update a policy, DROP and recreate — never ALTER POLICY
BEGIN;
DROP POLICY IF EXISTS orders_branch_isolation ON orders;
CREATE POLICY orders_branch_isolation ON orders
  USING (branch_id = current_setting('app.branch_id')::uuid)
  WITH CHECK (branch_id = current_setting('app.branch_id')::uuid);
COMMIT;
```

## Full Reference

### Running migrations
```bash
supabase db push           # apply pending migrations to linked project
supabase db reset          # reset local DB and replay all migrations
supabase migration new <name>  # scaffold a new migration file
```

### Rollback strategy
Supabase migrations are forward-only. Write a separate rollback migration file (`_rollback.sql`) in the same directory for emergencies. Never apply rollback files automatically.

### Forbidden
- Editing a migration file after it has been applied to any environment
- Running raw DDL against production outside of a migration file
- Disabling RLS without replacing it with an equivalent policy
