---
id: data-modeling
title: "Data modeling — UUIDs, timestamps, soft delete, audit columns"
layer: generic
tags: [data-modeling, postgres, sql, uuid, soft-delete, audit-trail]
applies_to:
  task_types: [add-table, schema-migration, add-handler]
  stages: [2, 4]
size_tokens: 195
related: [rds-query, schema-migration, audit-logging, supabase-migration]
---

# data-modeling — Data Modeling Conventions

## Pattern Summary

Every table gets a standard set of columns. Consistency across tables makes queries predictable and audit trails complete.

**Standard columns for every table:**
```sql
CREATE TABLE orders (
  -- Identity
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tenant isolation (every multi-tenant table)
  branch_id   uuid NOT NULL REFERENCES branches(id),

  -- Domain columns go here
  status      text NOT NULL DEFAULT 'open',
  total_paise integer NOT NULL DEFAULT 0,

  -- Audit timestamps (every table)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Soft delete (tables where history matters)
  deleted_at  timestamptz   -- NULL = active; NOT NULL = soft-deleted
);

-- Keep updated_at current via trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

**Soft delete query pattern:**
```typescript
// Always filter deleted rows unless explicitly querying history
const activeOrders = await db.query(
  "SELECT * FROM orders WHERE branch_id=$1 AND deleted_at IS NULL",
  [branchId]
);

// Soft delete — never hard delete rows with financial or audit relevance
await db.query(
  "UPDATE orders SET deleted_at=NOW() WHERE id=$1 AND branch_id=$2",
  [orderId, branchId]
);
```

## Full Reference

### UUID vs serial
Always UUID for `id`. Serial integers expose row counts to clients, make merges and data migrations harder, and cannot be pre-generated client-side.

### Paise not floats
Store monetary amounts in the smallest unit (paise for INR, cents for USD). `integer NOT NULL` — never `decimal` or `float` for money. Floating-point arithmetic on money causes rounding errors.

### When to hard delete
Session tokens, ephemeral cache entries, event dedup records after TTL. Never hard delete: financial transactions, user-facing orders, audit log entries, compliance records.
