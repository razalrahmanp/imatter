---
id: pagination-pattern
title: "Pagination — cursor-based (keyset) over offset, stable ordering, edge cases"
layer: generic
tags: [pagination, cursor, keyset, offset, api, performance]
applies_to:
  task_types: [add-endpoint, add-handler]
  stages: [3, 5]
size_tokens: 200
related: [api-endpoint-design, rds-query, input-validation]
---

# pagination-pattern — Cursor-Based Pagination Pattern

## Pattern Summary

Use cursor-based (keyset) pagination for all list endpoints. Offset pagination breaks at scale and produces inconsistent results under concurrent writes. Cursor pagination is stable and O(log n) regardless of page depth.

**Cursor pagination implementation:**
```typescript
interface PageParams {
  limit: number;    // max 100, default 20
  after?: string;   // opaque cursor (base64-encoded)
}

interface PageResult<T> {
  data: T[];
  nextCursor: string | null;  // null = last page
  hasMore: boolean;
}

// Cursor encodes (created_at, id) — unique stable sort
function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  return JSON.parse(Buffer.from(cursor, "base64url").toString());
}

async function listOrders(
  db: PoolClient, branchId: string, params: PageParams
): Promise<PageResult<Order>> {
  const limit = Math.min(params.limit, 100);
  let whereClause = "WHERE branch_id = $1";
  const queryParams: unknown[] = [branchId];

  if (params.after) {
    const { createdAt, id } = decodeCursor(params.after);
    whereClause += ` AND (created_at, id) < ($2, $3)`;
    queryParams.push(createdAt, id);
  }

  const { rows } = await db.query<Order>(
    `SELECT * FROM orders ${whereClause}
     ORDER BY created_at DESC, id DESC
     LIMIT $${queryParams.length + 1}`,
    [...queryParams, limit + 1]  // fetch one extra to detect hasMore
  );

  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);
  const lastRow = data[data.length - 1];

  return {
    data,
    hasMore,
    nextCursor: hasMore ? encodeCursor(lastRow.created_at, lastRow.id) : null,
  };
}
```

## Full Reference

### Why not offset?
`OFFSET 1000` scans and discards 1000 rows. Slow on large tables. Also: if a row is inserted/deleted between pages, items shift — users see duplicates or skip items.

### API response shape
```json
{ "data": [...], "nextCursor": "eyJjcmVh...", "hasMore": true }
```
Clients pass `?after=<nextCursor>` to get the next page. Never expose internal row IDs or timestamps directly — always opaque cursor.

### Forbidden
- `OFFSET N` pagination for tables > 10K rows
- Exposing `created_at` or `id` directly as the cursor value (opaque cursor prevents assumptions about internals)
