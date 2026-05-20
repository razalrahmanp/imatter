# compaction-checkpoint — Context Compaction and Writer State Flush

## Pattern Summary

A writer agent accumulates state across iterations. Compact when the iteration count or error count crosses the threshold.

```typescript
// When to compact — checked at the start of each iteration
function shouldCompact(checkpoint: TaskCheckpoint): boolean {
  return (
    checkpoint.current_iteration >= 5 ||          // iteration budget exceeded
    checkpoint.fail_count >= 2 ||                  // blocked — needs human review
    checkpoint.status === "flagged"                // explicitly flagged
  );
}

// Compaction payload — what survives the flush (sent to sdlc_task_checkpoint)
interface CompactionPayload {
  task_id: string;
  last_working_state: string;   // what was passing before the block
  remaining_work: string;       // what is still needed
  blocker: string;              // why it stopped
  artifacts_produced: string[]; // files changed so far
}
```

**When to call `sdlc_task_checkpoint` with status `"complete"`:**
1. All acceptance criteria for the task are met
2. Tests pass (if task involves code)
3. No open lint errors on touched files

**When to call with status `"blocked"`:**
1. Two consecutive iterations with the same error (same `error` message, different `error_lines` OK)
2. A dependency is missing (module not found, env var not set)
3. The task requires a decision outside the writer's authority (schema change, new dependency)

## Full Reference

### Compact reload flow
```
Writer hits fail_count >= 2
  → sdlc_task_checkpoint(status: "blocked", ...)
  → MCP sets task.status = "flagged"
  → Next session: sdlc_task_checkpoint(task_id) returns compact reload payload
  → Human reviews blocker, provides context
  → Writer resumes from last_working_state with new instruction
```

### Compact reload payload (returned by sdlc_task_checkpoint on reload)
```json
{
  "task_id": "s05-build-config",
  "status": "flagged",
  "current_iteration": 3,
  "last_changes": "Updated tsconfig.json outDir to ../plugin/dist",
  "next_action": "Verify compiled output location",
  "error": "Cannot find module '../plugin/dist/server'",
  "blocker": "outDir mismatch — compiled files not in expected location",
  "artifacts": ["tsconfig.json", "package.json"]
}
```

### Rules
- Never start iteration N+1 if iteration N is `"blocked"` — flag and stop
- Compact payload must fit in ~100 tokens — no full file contents, no stack traces
- `artifacts_produced` lists only files actually modified, not files read
- After compaction, new writer session reads compact payload first, then reads only the blocked file
