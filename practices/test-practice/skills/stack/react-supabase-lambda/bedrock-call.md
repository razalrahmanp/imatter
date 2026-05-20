---
id: bedrock-call
title: "Bedrock Claude call — max_tokens, model routing, prompt caching"
layer: stack
stack: react-supabase-lambda
tags: [aws, bedrock, claude, llm, ai, prompt-caching, max-tokens]
applies_to:
  task_types: [add-ai-call, add-worker, modify-llm-call]
  stages: [3, 9]
size_tokens: 250
related: [bedrock-max-tokens, pii-handling, lambda-worker, structured-logging]
context7_library_id: /aws/aws-sdk-js-v3
---

# bedrock-call — Bedrock Claude Invocation Pattern

## Pattern Summary

All Claude API calls use the shared wrapper. Never call Bedrock SDK directly in handler code.

```typescript
import { callClaude } from "../../shared/bedrock";
import { BEDROCK_MAX_TOKENS } from "../../shared/bedrock-limits";

const insight = await callClaude({
  system: ATLAS_SYSTEM_PROMPT,
  prompt: buildInsightPrompt(aggregatedStats),  // aggregates only — no PII
  maxTokens: BEDROCK_MAX_TOKENS.ATLAS_INSIGHT,  // always explicit
  cacheSystem: true,  // prompt caching when system prompt > 1024 tokens and reused
});
```

**Model routing by task:**
| Task | Model | maxTokens |
|------|-------|-----------|
| Intent classification | claude-3-5-haiku | 150 |
| Atlas insight generation | claude-3-5-sonnet | 400 |
| Structured extraction | claude-3-5-haiku | 300 |
| Audit / long analysis | claude-3-opus | 800 |

**max_tokens is always explicit — never rely on model defaults.**

**Prompt caching:** enable `cacheSystem: true` when system prompt > 1024 tokens AND reused across multiple calls in the same Lambda invocation.

## Full Reference

### callClaude shape (src/shared/bedrock.ts)
```typescript
interface BedrockCallOptions {
  system: string;
  prompt: string;
  maxTokens: number;
  cacheSystem?: boolean;
  modelId?: string;  // override default haiku
}
export async function callClaude(opts: BedrockCallOptions): Promise<string>
```

### Error handling
Catch `ThrottlingException` and re-throw for exponential backoff at the caller. Never retry in a tight loop inside `callClaude`.

### Forbidden
- `max_tokens` omitted — model defaults are too high and drive up cost
- Logging `opts.prompt` — may contain sensitive data
- Calling Bedrock from frontend — always proxy through Lambda
