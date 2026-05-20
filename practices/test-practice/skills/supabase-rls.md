# supabase-rls — Tenant Isolation via Row-Level Security

## Pattern Summary

Every new table must have RLS enabled and a branch-scoped policy before any data touches it.

```sql
-- Required on every new table — run in migration, never skip
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Branch isolation policy — branch_id comes from session variable, never from the query
CREATE POLICY orders_branch_isolation ON orders
  USING (branch_id = current_setting('app.branch_id')::uuid);

-- Set session variable before queries — done by withRls() in db.ts
SET LOCAL app.branch_id = $1;
```

**withRls enforces this in Lambda — the session variable is set before every query:**
```typescript
// src/shared/db.ts — withRls sets the session variable, then runs your fn
export async function withRls<T>(branchId: string, fn: (db: Pool) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("SET LOCAL app.branch_id = $1", [branchId]);
    return await fn(client as unknown as Pool);
  } finally {
    client.release();
  }
}
```

**Migration checklist for every new table:**
1. `ENABLE ROW LEVEL SECURITY` — must be first
2. Create `branch_isolation` policy using `current_setting('app.branch_id')`
3. Add `branch_id uuid NOT NULL REFERENCES branches(id)` column
4. Add index: `CREATE INDEX ON {table}(branch_id, created_at DESC)`
5. Never add a `BYPASSRLS` role to application users

## Full Reference

### Forbidden patterns
```sql
-- WRONG: policy referencing a request parameter (bypassable)
CREATE POLICY bad ON orders USING (branch_id = $1);

-- WRONG: no RLS on new table
CREATE TABLE new_events (...);  -- missing ENABLE ROW LEVEL SECURITY

-- WRONG: SELECT * without branch filter (even with RLS, be explicit in code)
SELECT * FROM orders;
```

### Verifying RLS is active
```sql
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'orders';
-- relrowsecurity must be true
```

### Multi-table joins
When joining tables, all joined tables must have RLS enabled. Joining a non-RLS table to an RLS table does not inherit the policy.
