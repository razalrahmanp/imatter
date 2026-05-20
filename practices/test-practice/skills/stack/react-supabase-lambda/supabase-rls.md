---
id: supabase-rls
title: "Supabase RLS — tenant isolation on every new table"
layer: stack
stack: react-supabase-lambda
tags: [supabase, postgresql, rls, tenant-isolation, security, database]
applies_to:
  task_types: [add-migration, add-table, modify-schema]
  stages: [6, 7]
size_tokens: 220
related: [schema-migration, rds-query, lambda-handler, authn-pattern]
context7_library_id: /brianc/node-postgres
---

# supabase-rls — Row-Level Security Pattern

## Pattern Summary

Every new table must have RLS enabled and a branch-scoped policy before any data is written.

```sql
-- Required on every new table — run in migration, never skip
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_branch_isolation ON orders
  USING (branch_id = current_setting('app.branch_id')::uuid);
```

**withRls sets the session variable before every query:**
```typescript
// src/shared/db.ts — sets app.branch_id, then runs fn
export async function withRls<T>(branchId: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SET LOCAL app.branch_id = $1", [branchId]);
    return await fn(client as unknown as PoolClient);
  } finally { client.release(); }
}
```

**Migration checklist for every new table:**
1. `ENABLE ROW LEVEL SECURITY` — must be first
2. Create `branch_isolation` policy using `current_setting('app.branch_id')`
3. Add `branch_id uuid NOT NULL REFERENCES branches(id)` column
4. Add index: `CREATE INDEX ON {table}(branch_id, created_at DESC)`
5. Never grant `BYPASSRLS` to application users

## Full Reference

### Verifying RLS is active
```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'orders';
-- relrowsecurity must be TRUE
```

### Multi-table joins
All joined tables must have RLS enabled. Joining a non-RLS table to an RLS table does NOT inherit the policy.

### Forbidden
- `pool.query(...)` without going through `withRls`
- Any policy that references `$1` instead of `current_setting('app.branch_id')`
- `BYPASSRLS` on any application role
