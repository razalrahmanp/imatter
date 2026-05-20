---
id: coa-collision-check
title: "COA collision check — verify against live COA before proposing codes"
layer: project
project: rabos
tags: [rabos, coa, chart-of-accounts, collision, accounting, validation]
applies_to:
  task_types: [add-posting-rule, modify-posting-rule, add-coa-rule, add-ai-call]
  stages: [3, 7]
size_tokens: 210
related: [posting-rule, supabase-rls, rds-query]
---

# coa-collision-check — COA Collision Check Pattern

## Pattern Summary

Before any code proposes or saves a Chart of Accounts code, it must verify the code against the live COA. No exceptions.

```typescript
// src/shared/coa/collision.ts
export interface CoaCollisionResult {
  hasConflict: boolean;
  conflictingCodes: string[];    // codes that already exist with a different type
  notInCoa: string[];            // codes that don't exist in COA at all
}

export async function checkCoaCollision(
  proposedCodes: string[],
  branchId: string
): Promise<CoaCollisionResult> {
  return withRls(branchId, async (db) => {
    const { rows } = await db.query<{ code: string; account_type: string }>(
      "SELECT code, account_type FROM chart_of_accounts WHERE branch_id = $1 AND code = ANY($2)",
      [branchId, proposedCodes]
    );
    const existingMap = new Map(rows.map((r) => [r.code, r.account_type]));
    const notInCoa = proposedCodes.filter((c) => !existingMap.has(c));
    // "conflict" = code exists but is the wrong type for the proposed usage
    // Caller provides expected type; here we surface the existing map for caller to decide
    return {
      hasConflict: notInCoa.length > 0,
      conflictingCodes: [],
      notInCoa,
    };
  });
}
```

**When Claude (Atlas/RIS) proposes account codes:**
```typescript
const proposed = extractCodesFromClaudeOutput(claudeResponse);
const collision = await checkCoaCollision(proposed, branchId);

if (collision.hasConflict || collision.notInCoa.length > 0) {
  // Return the issue to the user — never silently create new COA entries
  return { error: "Proposed account codes not in COA", details: collision };
}
// Only proceed if all codes are in COA
```

**The check is read-only and cheap.** Run it on every proposal, not just on save.

## Full Reference

### Why at proposal time, not just save time
If the user sees a posting rule with invalid codes in the UI and tries to save, the error is confusing. Surface the collision at proposal time so Claude can re-propose with valid codes.

### COA code format (RABOS standard)
- Format: `{type_prefix}-{4-digit}` (e.g. `ASSET-1001`, `EXPENSE-4020`)
- Type prefixes: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, `EXPENSE`
- Never auto-create COA entries — only humans add to the chart of accounts

### Forbidden
- Proposing account codes without running this check first
- Auto-creating missing COA entries
- Caching COA data beyond 5 minutes (account deletions must propagate)
