---
name: sdlc-tenant-isolation
description: Use when designing or auditing any multi-tenant system — covers the four isolation models, the row-level security pattern, and the failure modes that leak data across tenants.
---

## Rule

Tenant isolation means tenant A can never see, modify, or affect tenant B's data — by accident or by attack. Pick an isolation model, enforce it at the lowest possible layer (database, not application), and audit relentlessly.

## Four isolation models

| Model | Storage | Complexity | When |
|---|---|---|---|
| **Silo** | Separate DB per tenant | High infra cost | Banking, healthcare, regulated industries; large enterprise tenants |
| **Pool** | Single DB, tenant_id column on every table | Low infra cost, app discipline required | SaaS startups, most B2B apps |
| **Bridge** | Schema per tenant in one DB | Medium | Hybrid — fewer DBs than silo, more isolation than pool |
| **Hybrid** | Pool by default, silo for large tenants | Highest complexity | Mature SaaS with mixed tenant sizes |

**Most projects should start with Pool.** Migrating to Silo later is hard; over-engineering Silo on day 1 is expensive.

## Pattern — Pool with Postgres RLS

```sql
-- Every tenant-owned table has tenant_id and RLS
ALTER TABLE orders ADD COLUMN tenant_id UUID NOT NULL;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE INDEX orders_tenant_id_idx ON orders (tenant_id);
```

```ts
// At the start of every authenticated request:
await db.query("SET LOCAL app.tenant_id = $1", [claims.tenant_id]);
// All subsequent queries in this transaction are auto-filtered.
```

The `true` argument to `current_setting` makes it return NULL if not set. Pair this with a default-deny policy so missing context fails closed, not open.

## What to verify on every new tenant-owned table

- [ ] Has `tenant_id` column (NOT NULL)
- [ ] Has RLS enabled
- [ ] Has a policy that filters on `tenant_id`
- [ ] Has an index on `tenant_id` (or a composite starting with `tenant_id`)
- [ ] Foreign keys to other tenant-owned tables include `tenant_id` in the constraint (compound FK)

## Common cross-tenant leaks

| Leak | Where |
|---|---|
| Forgot RLS on a new table | New migrations |
| Service-role DB connection in app code | Bypasses RLS — only for admin scripts |
| Caching: shared cache key without tenant_id | Redis, in-memory caches |
| Aggregate queries via raw SQL bypassing the ORM | Reports, dashboards |
| File storage paths without tenant_id segment | S3, blob storage |
| Search index documents without tenant_id field | Elasticsearch, Algolia |
| Background jobs reading "next unprocessed row" without tenant filter | Workers, schedulers |
| Webhooks fanning out without per-tenant routing | Event buses |

## Anti-patterns

- ❌ "We'll add tenant_id later, it's still in development" — adding it after data exists is a migration nightmare
- ❌ Using a service-role / superuser connection for normal app queries (bypasses RLS)
- ❌ Tenant ID in URL path but not verified against the JWT (anyone can swap it)
- ❌ Caching responses keyed only by resource ID, not (tenant_id, resource_id)
- ❌ Cross-tenant features ("admin can see all tenants") implemented without an audit log

## Gate criteria

- Every tenant-owned table has RLS enabled, a policy on `tenant_id`, and an index on `tenant_id`
- The app sets `SET LOCAL app.tenant_id` at the start of every authenticated transaction
- No app code uses the service-role / superuser DB connection except documented admin scripts
- Cache keys include tenant_id when caching tenant-owned data
- File storage paths include a tenant_id segment
- A periodic test exists that creates two tenants, writes data as each, and verifies neither can read the other's via the API
