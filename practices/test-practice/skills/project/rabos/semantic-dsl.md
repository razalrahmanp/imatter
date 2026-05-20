---
id: semantic-dsl
title: "Semantic DSL — RIS Analyst pattern, no raw SQL ever"
layer: project
project: rabos
tags: [rabos, ris, semantic-dsl, sql, analyst, llm]
applies_to:
  task_types: [add-analyst, modify-analyst, add-query, add-ai-call]
  stages: [3, 7]
size_tokens: 260
related: [bedrock-call, rds-query, supabase-rls, pii-handling]
---

# semantic-dsl — RIS Analyst Pattern

## Pattern Summary

The RIS Analyst never writes raw SQL. It generates a semantic intent object; the query layer translates it.

```typescript
// CORRECT — analyst emits intent, not SQL
const intent: AnalystIntent = {
  entity: "orders",
  filters: [
    { field: "branch_id", op: "eq", value: branchId },
    { field: "status",    op: "in", value: ["pending", "preparing"] },
  ],
  aggregations: [{ fn: "count", alias: "total" }],
  window: { last_days: 7 },
};
const result = await semanticQuery(intent, branchId);

// WRONG — analyst generating SQL strings
const sql = `SELECT COUNT(*) FROM orders WHERE branch_id = '${branchId}'`;
```

**`semanticQuery` enforces:**
- RLS injection via `withRls(branchId, ...)` — analyst cannot bypass tenant isolation
- Parameterized SQL internally — no string interpolation, ever
- Field whitelist — only schema-registered fields accepted in `filters`
- No `SELECT *` — columns determined by registered projection for each entity

**Analyst output contract (what Claude returns):**
```typescript
interface AnalystIntent {
  entity: string;                              // registered entity name
  filters: Array<{ field: string; op: FilterOp; value: unknown }>;
  aggregations?: Array<{ fn: AggFn; field?: string; alias: string }>;
  groupBy?: string[];
  orderBy?: Array<{ field: string; dir: "asc" | "desc" }>;
  window?: { last_days?: number; from?: string; to?: string };
  limit?: number;
}
```

## Full Reference

### Field registration
Every queryable field must be registered in `src/shared/ris/schema.ts` with its column name, type, and allowed operators. Unregistered fields are rejected at query time — not silently ignored.

### Why no raw SQL from the analyst
Claude cannot be trusted to parameterize SQL correctly under adversarial prompts. The semantic layer is the trust boundary — SQL is generated only from validated intent objects, never from model output.

### Forbidden
- `db.query(claudeOutput)` — never pass model output directly to DB
- Template literal SQL anywhere in analyst code
- Filtering on unregistered fields (rejected at runtime)
