---
id: bedrock-max-tokens
title: "Bedrock token caps — explicit budgets per task type"
layer: stack
stack: react-supabase-lambda
tags: [aws, bedrock, claude, llm, cost, tokens, budget]
applies_to:
  task_types: [add-ai-call, modify-llm-call]
  stages: [3, 9]
size_tokens: 170
related: [bedrock-call, pii-handling]
---

# bedrock-max-tokens — Token Budget Caps by Task

## Pattern Summary

Always import from `BEDROCK_MAX_TOKENS`. Never hardcode token counts locally.

```typescript
// src/shared/bedrock-limits.ts — single source of truth
export const BEDROCK_MAX_TOKENS = {
  INTENT_CLASSIFICATION: 150,
  ENTITY_EXTRACTION:     300,
  ATLAS_INSIGHT:         400,
  MENU_SUGGESTION:       200,
  AUDIT_REPORT:          800,
} as const;

// Usage
import { BEDROCK_MAX_TOKENS } from "../../shared/bedrock-limits";
const result = await callClaude({
  ...,
  maxTokens: BEDROCK_MAX_TOKENS.ATLAS_INSIGHT,
});
```

**Why caps matter:**
- Output tokens cost 5× input tokens on Sonnet — uncapped generation blows Lambda budget
- A well-scoped `max_tokens` forces tighter prompts — the model answers the question, not an essay
- Adding a new task type? Add a named constant first, then use it — never inline a magic number

## Full Reference

### Prompt caching break-even
Enable caching when:
- System prompt > 1024 tokens
- Same system prompt reused across multiple calls in the same invocation
- Call is non-realtime (latency trade-off acceptable)

Do NOT cache for one-shot calls or when the system prompt changes per request.
