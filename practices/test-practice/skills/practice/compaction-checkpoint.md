---
id: compaction-checkpoint
title: "Compaction checkpoint — when to flush writer state and compact"
layer: practice
tags: [ai-coding, writer-agent, context-management, checkpoint, iteration]
applies_to:
  task_types: [all]
  stages: [all]
size_tokens: 200
related: [runbook-pattern, incident-response]
---

# compaction-checkpoint — Context Compaction and Writer State Flush

## Pattern Summary

A writer agent accumulates state across iterations. Compact when iteration count or error count crosses the threshold.

**When to compact:**
```
compact when:
  current_iteration >= 5       — iteration budget exceeded
  fail_count >= 2              — blocked, needs human review
  status === "flagged"         — explicitly flagged by orchestrator
```

**Status transitions:**
```
in_progress → blocked (same error, 2nd time)
blocked     → flagged (fail_count >= 2, human review required)
flagged     → in_progress (human resolves, unblocks)
any         → complete (all acceptance criteria met, tests pass)
```

**Compact reload payload (what survives the flush — ~100 tokens):**
```json
{
  "task_id": "orders-create-handler",
  "file": "src/functions/orders/handler.ts",
  "iteration": 3,
  "status": "blocked",
  "next_action": "Fix TS2345 on line 42 — argument type mismatch",
  "current_error": "TS2345: Argument of type 'string' is not assignable...",
  "error_lines": ["src/functions/orders/handler.ts:42"],
  "fail_count": 2
}
```

**After compaction: new writer session reads compact payload first, then reads ONLY the blocked file. No conversation history.**

## Full Reference

### When status = "complete"
All of these must be true:
1. Acceptance criteria from the task definition are met
2. TypeScript compiles without errors on touched files
3. No lint errors on touched files
4. Tests pass if task involves logic changes

### When to flag vs. abandon
Flag (flagged → human review): dependency missing, schema change needed, decision required
Abandon: task spec is contradictory — log in open items, close task, create a new one
