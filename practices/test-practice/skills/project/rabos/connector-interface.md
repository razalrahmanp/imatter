---
id: connector-interface
title: "Connector interface — universal list/read/write contract"
layer: project
project: rabos
tags: [rabos, connector, interface, integration, contract, typescript]
applies_to:
  task_types: [add-connector, modify-connector, add-integration]
  stages: [3, 5]
size_tokens: 250
related: [supabase-rls, rabos-event-shape, input-validation]
---

# connector-interface — Universal Connector Contract

## Pattern Summary

Every data connector implements the same three-method interface. No connector exposes additional public methods.

```typescript
// src/shared/connectors/types.ts — the contract every connector must satisfy
export interface Connector<TRecord, TQuery = Partial<TRecord>> {
  list(branchId: string, query: TQuery): Promise<ConnectorPage<TRecord>>;
  read(branchId: string, id: string):    Promise<TRecord | null>;
  write(branchId: string, data: TRecord | Partial<TRecord>, id?: string): Promise<TRecord>;
}

export interface ConnectorPage<T> {
  items: T[];
  total: number;
  cursor?: string;   // opaque pagination token
}

// Implementing a connector
export class OrdersConnector implements Connector<Order, OrderQuery> {
  async list(branchId: string, query: OrderQuery): Promise<ConnectorPage<Order>> {
    return withRls(branchId, async (db) => {
      const { rows, rowCount } = await db.query<Order>(
        "SELECT id, status, total FROM orders WHERE branch_id = $1 AND status = ANY($2) ORDER BY created_at DESC LIMIT $3",
        [branchId, query.statuses ?? null, query.limit ?? 20]
      );
      return { items: rows, total: rowCount ?? 0 };
    });
  }

  async read(branchId: string, id: string): Promise<Order | null> {
    return withRls(branchId, async (db) => {
      const { rows } = await db.query<Order>(
        "SELECT id, status, total FROM orders WHERE branch_id = $1 AND id = $2",
        [branchId, id]
      );
      return rows[0] ?? null;
    });
  }

  async write(branchId: string, data: Partial<Order>, id?: string): Promise<Order> {
    // upsert pattern — id present = update, absent = insert
    return withRls(branchId, async (db) => { /* ... upsert ... */ });
  }
}
```

**Registration:** every connector is registered in `src/shared/connectors/registry.ts`. The orchestrator always fetches connectors from the registry by name — never instantiates them directly.

## Full Reference

### Why three methods only
Additional methods (e.g. `bulkWrite`, `search`, `aggregate`) bypass the audit log and the event emission hooks. All bulk operations go through `write` with batched payloads. All search/aggregation goes through the RIS Analyst semantic layer.

### Pagination
`list` always returns `ConnectorPage`. Never return a raw array. The cursor token is opaque — connectors manage their own cursor format internally.

### Forbidden
- Public methods beyond `list`, `read`, `write`
- Bypassing `withRls` inside any connector method
- Returning `undefined` from `read` — return `null` for not-found
