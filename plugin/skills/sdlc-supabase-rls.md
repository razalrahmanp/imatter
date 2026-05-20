---
name: sdlc-supabase-rls
description: Use when designing or auditing Postgres Row-Level Security (RLS) — covers the policy patterns, the service-role escape hatch, and the gotchas that lead to cross-tenant data leaks.
---

## When to use

- Building any multi-tenant feature on Postgres (Supabase, RDS, Cloud SQL, self-hosted)
- Adding a new table that holds tenant-owned data
- Auditing existing tables for missing or broken RLS
- Debugging "I can see another tenant's row" bugs

## Rule

RLS is the database's last line of defense against cross-tenant data leaks. Every tenant-owned table has RLS enabled, has a policy that filters on `tenant_id` (or equivalent), and the application sets the relevant session variable / JWT claim before any query. The service role bypasses RLS — use it sparingly and only from server-side admin paths.

## Pattern — enable + policy + index

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- The policy
CREATE POLICY orders_tenant_isolation ON orders
  AS RESTRICTIVE                       -- AND'ed with other policies (default is PERMISSIVE which OR's)
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Required index for performance
CREATE INDEX orders_tenant_id_idx ON orders (tenant_id);
```

| Clause | Applies to |
|---|---|
| `USING` | SELECT, UPDATE, DELETE — filters which rows you see |
| `WITH CHECK` | INSERT, UPDATE — restricts which rows you can write |

If you set only `USING`, inserts of any tenant_id would succeed — disaster. **Always set both.**

## App-side: set the session variable

```ts
// At the start of every authenticated request transaction
await db.query("SET LOCAL app.tenant_id = $1", [claims.tenant_id]);

// All subsequent queries in this transaction are filtered automatically
const orders = await db.query("SELECT * FROM orders");
```

`SET LOCAL` (not `SET`) scopes to the transaction. When the transaction ends, the value is cleared — preventing leakage to other requests sharing the same connection.

## Supabase-specific: using `auth.jwt()`

If you're using Supabase's `auth.jwt()` helper:

```sql
CREATE POLICY orders_select ON orders FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

This reads the JWT directly without needing to `SET LOCAL`. Useful when the client connects directly via PostgREST.

For Lambda / backend connections: prefer `SET LOCAL app.tenant_id` since the JWT isn't automatically available.

## Service role — escape hatch, used carefully

The service role bypasses RLS. Use it only for:

- One-time admin scripts run by humans
- Cross-tenant batch jobs (anonymized analytics, backups)
- Internal tools that explicitly need cross-tenant visibility (with audit log)

```ts
// Never use the service role for normal app traffic.
const adminClient = new Client({ connectionString: process.env.DATABASE_URL_SERVICE_ROLE });
```

Gate this hard:
- Service role credentials in a *separate* secret, accessible only to specific Lambda functions
- Every service-role query writes an audit log entry ([[sdlc-audit-logging]])
- A CI check forbids `process.env.DATABASE_URL_SERVICE_ROLE` outside the admin module path

## Common patterns

### Inserting into a tenant table — let the app supply tenant_id

```ts
await db.query(
  "INSERT INTO orders (id, tenant_id, customer_id) VALUES ($1, $2, $3)",
  [orderId, claims.tenant_id, customerId]   // tenant_id from token, NOT from request body
);
```

`WITH CHECK` ensures even if app code messed up, the DB rejects an insert with the wrong tenant_id.

### Cross-tenant queries from inside the app — explicit elevation

```ts
await db.transaction(async (tx) => {
  await tx.query("SET LOCAL ROLE service_role");      // elevate
  await tx.query("SELECT * FROM orders WHERE created_at > now() - interval '7 days'");
});
```

Auditing this is easier than auditing a separate connection. Or split into a clearly-named admin RPC.

### View / function inheritance

By default, views run with the rights of the calling user → RLS applies. Functions can run with `SECURITY DEFINER` → bypass RLS — that's a foot-gun:

```sql
CREATE FUNCTION get_my_orders() RETURNS SETOF orders
LANGUAGE sql
SECURITY INVOKER   -- explicit; runs as caller, RLS applies
AS $$
  SELECT * FROM orders;
$$;
```

Always specify `SECURITY INVOKER` or `SECURITY DEFINER` deliberately. Default is `INVOKER` but be explicit.

## Foreign key constraints + tenant isolation

Compound FKs prevent cross-tenant references:

```sql
CREATE TABLE order_items (
  id           UUID PRIMARY KEY,
  tenant_id    UUID NOT NULL,
  order_id     UUID NOT NULL,
  FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id)
);
```

Without `tenant_id` in the FK, tenant A could create an `order_item` referencing tenant B's `order`. Add a composite PK on `(tenant_id, id)` in the parent.

## Anti-patterns

- ❌ `USING (true)` (you forgot the filter)
- ❌ Only `USING`, no `WITH CHECK` (insert any tenant_id you like)
- ❌ Reading `tenant_id` from request body and trusting it (the JWT is the source)
- ❌ Service-role connection used in normal app code (RLS bypassed; one bug = data leak)
- ❌ Forgetting RLS on a newly-added table (it's disabled by default)
- ❌ Index missing on `tenant_id` (RLS works but slow → app times out → operators disable RLS in panic)
- ❌ `SET` instead of `SET LOCAL` (variable persists across requests on shared connection)
- ❌ Views without explicit `SECURITY INVOKER`
- ❌ Single FK column reference to a tenant-owned table (no compound key)

## Testing RLS

A periodic test:
1. Create two tenants in test DB
2. Insert one row as each
3. Connect with tenant A's token
4. Try to read, update, delete tenant B's row — all should fail
5. Try to insert with `tenant_id = B` — should fail

If any of those succeed, RLS is broken.

## Gate criteria

- Every tenant-owned table has RLS enabled
- Every tenant-owned table has a policy on `tenant_id` with both `USING` and `WITH CHECK`
- Every tenant-owned table has an index on `tenant_id` (or a composite index starting with it)
- App sets `SET LOCAL app.tenant_id` at the start of every authenticated transaction (or uses `auth.jwt()` when appropriate)
- Service-role connection is gated to a documented module path; CI forbids its use elsewhere
- A periodic cross-tenant leak test exists and runs against a real Postgres instance
- New tables in migrations are blocked at review if RLS is missing
