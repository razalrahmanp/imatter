---
id: posting-rule
title: "Posting rule — visual posting rules, COA collision check"
layer: project
project: rabos
tags: [rabos, posting-rules, coa, accounting, visual, collision]
applies_to:
  task_types: [add-posting-rule, modify-posting-rule, add-coa-rule]
  stages: [3, 7]
size_tokens: 240
related: [coa-collision-check, supabase-rls, rds-query]
---

# posting-rule — Visual Posting Rules Pattern

## Pattern Summary

Every posting rule is stored as a JSON visual definition, not code. Rules run through the interpreter — never hardcoded.

```typescript
// Posting rule definition (stored in DB, not code)
interface PostingRuleDef {
  id: string;
  trigger: { entity: string; event: "create" | "update" | "delete" };
  lines: PostingLine[];
  description: string;
}

interface PostingLine {
  account_code: string;  // must pass COA collision check before save
  dr_cr: "debit" | "credit";
  amount_formula: string;  // safe expression: "transaction.amount * 1.18"
  description_template: string;
}

// Before saving any posting rule — always check COA collision
const collision = await checkCoaCollision(rule.lines.map((l) => l.account_code), branchId);
if (collision.hasConflict) {
  return { error: `Account code conflict: ${collision.conflictingCodes.join(", ")}` };
}
await savePostingRule(rule, branchId);
```

**COA collision check is mandatory before every rule save — no exceptions.**

**Amount formula evaluation:** use the safe expression evaluator (`src/shared/posting/evaluator.ts`), never `eval()`. Only whitelisted variables and arithmetic operators are allowed.

**Posting rule execution (when a trigger fires):**
```
1. Load rule by trigger (entity + event)
2. Evaluate each line's amount_formula against transaction context
3. Verify COA codes still exist (rules outlive COA changes)
4. Insert journal entries atomically in a transaction
5. Emit posting.completed event
```

## Full Reference

### Amount formula safety
Allowed: `+`, `-`, `*`, `/`, `(`, `)`, numeric literals, and whitelist variables (`transaction.amount`, `transaction.tax_rate`, `transaction.quantity`).
Disallowed: function calls, string operations, property access beyond whitelist.

### Forbidden
- Hardcoded account codes anywhere except the posting rule definition
- `eval()` for formula evaluation
- Saving a posting rule without a COA collision check
- Posting rules that reference deleted accounts (check on rule load, not just save)
