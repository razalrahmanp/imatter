---
name: sdlc-authz-pattern
description: Use when implementing access control (who can do what to which resource) — required reading before adding any role check, permission check, or row-level filter.
---

## Rule

Authorization is "what can you do?" — distinct from authentication ("who are you?"). Every protected operation answers three questions: who is the actor, what action are they attempting, on which resource?

## Pattern

```ts
authorize(actor, action, resource) → allow | deny + reason
```

The check happens at the **earliest** point where all three are known. Usually: after token verification, before any DB read or write.

```ts
export const handler = async (req, res) => {
  const actor = await verifyToken(req);                   // who
  const orderId = req.params.id;                          // what
  const order = await db.orders.findById(orderId);        // which
  if (!order) return res.status(404).end();

  if (!authorize(actor, "order.read", order)) {
    return res.status(403).json({ error: "forbidden" });
  }

  return res.json(order);
};
```

## Authorization models — pick one and stay consistent

| Model | When to use | Example |
|---|---|---|
| Role-based (RBAC) | Few well-defined roles, low role explosion | `admin`, `staff`, `customer` |
| Attribute-based (ABAC) | Many context-dependent rules | "Manager of branch X can read orders for branch X" |
| Relationship-based (ReBAC) | Resource hierarchies, sharing | Google Drive's "shared with me" |
| Policy-as-code (OPA, Cedar) | Complex rules, audit requirements | Enterprise/compliance contexts |

Most apps need RBAC + a few ABAC rules on top. Don't reach for Cedar/OPA until RBAC genuinely fails.

## Tenant isolation (cross-cutting)

If the system is multi-tenant, **every** query carries the tenant ID, enforced at the DB layer where possible:

```sql
-- Postgres: row-level security (RLS)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY orders_tenant_isolation ON orders
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

Then in app code, `SET LOCAL app.tenant_id = '<tenant>'` at the start of every transaction. RLS makes "forgot to filter by tenant" a database-level impossibility.

## Anti-patterns

- ❌ Authorizing in the UI only ("if (user.role === 'admin') showButton()") — backend must enforce too
- ❌ Trusting `tenant_id` from the request body — derive from the verified token
- ❌ Permission strings as free-form text ("can_edit_orders_v2") — define a typed enum
- ❌ Returning 403 with the resource data in the body ("can't access this, but here's a preview")
- ❌ Checking permissions after reading the resource into memory and returning it
- ❌ Different error codes for "not found" vs "not authorized" — both should be 404 to prevent enumeration
- ❌ Caching authorization decisions across requests without invalidation on role change

## Gate criteria

- Every protected route has an explicit `authorize(actor, action, resource)` call before the business logic
- Multi-tenant tables enforce isolation at the DB layer (RLS or equivalent), not just in code
- Permission strings are defined in a single typed enum/union, not free-form
- 403 responses do not leak whether the resource exists
- Authorization logic is unit-tested for at least: owner allowed, non-owner denied, admin allowed, anonymous denied
