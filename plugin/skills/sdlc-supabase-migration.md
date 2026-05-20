---
name: sdlc-supabase-migration
description: Use when writing any Supabase / Postgres migration — covers ordering, backwards compatibility, RLS setup, and the deploy-safe patterns that avoid downtime.
---

## Rule

Every DDL change is a migration. Migrations are versioned, ordered, never edited after merge, and backwards-compatible across the deploy window — old code must work against the new schema, and the migration must be reversible (or have a documented rollback).

## File naming

```
supabase/migrations/
  20260520120000_create_orders_table.sql
  20260520130500_add_orders_status_index.sql
  20260521090000_add_orders_currency_column.sql
```

UTC timestamp prefix → strict ordering. Descriptive snake_case name. One logical change per file.

## Backwards-compatible deploys — the rule

For zero-downtime deploys, the migration must be safe against both the current code AND the next code at the same time.

| Change | How |
|---|---|
| **Adding a column** | Add as nullable or with default. Safe immediately. Backfill in a second migration if needed. |
| **Renaming a column** | Two-step: add new, dual-write, backfill, switch reads, drop old. Never rename in one step. |
| **Changing a type** | Two-step: add new column, dual-write, backfill, switch reads, drop old. |
| **Dropping a column** | Three-step: stop writing → wait one deploy → drop. |
| **Adding an index** | `CREATE INDEX CONCURRENTLY` (Postgres) — doesn't block writes |
| **Adding a NOT NULL constraint** | Two-step: add column nullable with default → backfill → add NOT NULL |
| **Adding a foreign key** | `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID; ALTER TABLE ... VALIDATE CONSTRAINT ...` — separates scan from apply |

## Pattern — new table with RLS

```sql
-- 20260520120000_create_orders_table.sql

CREATE TABLE orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  customer_id UUID NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'shipped', 'cancelled')),
  total_paise BIGINT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX orders_tenant_id_idx ON orders (tenant_id);
CREATE INDEX orders_customer_id_idx ON orders (customer_id);

-- RLS: REQUIRED for tenant-owned tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation ON orders
  AS RESTRICTIVE
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- updated_at trigger
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

See [[sdlc-supabase-rls]] for the RLS specifics.

## Locks — what blocks what

| Lock | Operations | Blocks |
|---|---|---|
| `ACCESS EXCLUSIVE` | DROP, TRUNCATE, ALTER TABLE (most forms) | Everything |
| `EXCLUSIVE` | REFRESH MATERIALIZED VIEW CONCURRENTLY | Writes; not reads |
| `SHARE ROW EXCLUSIVE` | CREATE INDEX (not CONCURRENTLY) | Writes |
| `SHARE` | CREATE INDEX CONCURRENTLY | Almost nothing |
| `ACCESS SHARE` | SELECT | Almost nothing |

Rule: use `CONCURRENTLY` where available; split lock-heavy ops; do them at low-traffic windows.

## Migration tooling

- Supabase CLI (`supabase migration new`, `supabase db push`)
- Plain SQL files run via deploy script
- Tools: dbmate, sqitch, knex/prisma migrations

Whatever the tool: migrations are committed, versioned, sequentially applied, never re-edited.

## Rollback

Each migration has a documented rollback in the same file (commented) or a paired `down` migration:

```sql
-- UP
ALTER TABLE orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'INR';

-- DOWN (rollback, paste into emergency)
-- ALTER TABLE orders DROP COLUMN currency;
```

For non-trivial migrations (data backfills), document the rollback steps in the runbook ([[sdlc-runbook-pattern]]).

## Anti-patterns

- ❌ Editing a merged migration (others have already applied it; chaos)
- ❌ Two migrations with the same timestamp (ordering ambiguity)
- ❌ Multiple unrelated changes in one migration (rollback hard)
- ❌ Renaming a column in one step (breaks deployed old code)
- ❌ Adding NOT NULL without backfill (breaks existing rows)
- ❌ `CREATE INDEX` without `CONCURRENTLY` on production (writes locked)
- ❌ Forgetting RLS on a new tenant-owned table
- ❌ Dropping a column without a "stop writing" deploy first
- ❌ Migrations that depend on application-level state (config, env)

## Gate criteria

- Every schema change is a migration file (no direct SQL on prod)
- Naming follows timestamp + snake_case convention
- Indexes on new tenant-owned columns use `CONCURRENTLY`
- New tenant-owned tables have RLS enabled and policy in the same migration
- Two-step pattern used for renames / type changes / drops
- Rollback documented per migration
- A staging environment runs the migration before prod, with the previous code version still active (verifies backwards-compat)
