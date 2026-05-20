---
id: rds-query
title: "RDS PostgreSQL query — withRls, parameterized, paginated"
layer: stack
stack: react-supabase-lambda
tags: [aws, rds, postgresql, rls, sql, database, query]
applies_to:
  task_types: [add-query, add-endpoint, add-worker, modify-handler]
  stages: [3, 7]
size_tokens: 230
related: [supabase-rls, lambda-handler, schema-migration, structured-logging]
context7_library_id: /brianc/node-postgres
---

# rds-query — RDS PostgreSQL Query Pattern

## Pattern Summary

All database queries use `withRls`. Never use the bare pool directly.

```typescript
// CORRECT — always inside withRls
const orders = await withRls(branchId, async (db) => {
  const { rows } = await db.query<OrderRow>(
    "SELECT id, status, total FROM orders WHERE branch_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
    [branchId, status, limit ?? 20, offset ?? 0]
  );
  return rows;
});

// WRONG — bare pool, no RLS, no pagination
const { rows } = await pool.query("SELECT * FROM orders WHERE branch_id = $1", [branchId]);
```

**Parameterization rules:**
- Every variable in `$N` placeholder — no template literals in SQL, ever
- `branchId` appears as a parameter even inside `withRls` — belt-and-suspenders
- Column names are code constants — never `"SELECT $1 FROM orders"`

**Pagination required on all list queries:**
```typescript
const { rows } = await db.query(
  "SELECT id, status FROM orders WHERE branch_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
  [branchId, limit ?? 20, offset ?? 0]
);
```

**Error handling:**
```typescript
try {
  return await withRls(branchId, async (db) => { /* ... */ });
} catch (err) {
  console.error({ errorId: crypto.randomUUID(), message: "DB query failed" });
  throw err;  // re-throw for Lambda error handling
}
```

## Full Reference

### Transaction pattern
```typescript
await withRls(branchId, async (db) => {
  await db.query("BEGIN");
  try {
    await db.query("INSERT INTO ...", [...]);
    await db.query("COMMIT");
  } catch (e) { await db.query("ROLLBACK"); throw e; }
});
```

### Never do these
- `pool.query(...)` outside `withRls`
- Template literal SQL: `` `SELECT * FROM orders WHERE id = ${id}` ``
- `SELECT *` — always name columns explicitly
- Unbounded queries — always `LIMIT`
