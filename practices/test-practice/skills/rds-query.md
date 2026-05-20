# rds-query — RDS PostgreSQL Query Pattern

## Pattern Summary

All database queries use `withRls`. Never use the bare pool directly.

```typescript
// CORRECT — always inside withRls
const orders = await withRls(branchId, async (db) => {
  const { rows } = await db.query<OrderRow>(
    "SELECT id, status, total FROM orders WHERE branch_id = $1 AND status = $2",
    [branchId, status]   // parameterized — no string interpolation ever
  );
  return rows;
});

// WRONG — bare pool, no RLS
const { rows } = await pool.query("SELECT * FROM orders WHERE branch_id = $1", [branchId]);
```

**Parameterization rules:**
- Every variable goes in `$N` placeholder — no template literals in SQL
- `branchId` appears as a parameter even inside `withRls` — belt-and-suspenders
- Column names are code constants, not user input — never `"SELECT $1 FROM orders"`

**Pagination — required on all list queries:**
```typescript
const { rows } = await db.query(
  "SELECT id, status FROM orders WHERE branch_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
  [branchId, limit ?? 20, offset ?? 0]
);
```

**Error handling:**
```typescript
try {
  return await withRls(branchId, async (db) => { ... });
} catch (err) {
  // Log error ID only — never log the query or its parameters (may contain PII)
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
    await db.query("UPDATE ...", [...]);
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  }
});
```

### Never do these
- `pool.query(...)` outside `withRls`
- `\`SELECT * FROM orders WHERE id = ${id}\`` (template literal)
- `SELECT *` in production — always name columns explicitly
- Unbounded queries — always `LIMIT`
