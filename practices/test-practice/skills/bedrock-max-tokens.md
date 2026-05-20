# bedrock-max-tokens — Token Budget Caps by Task

## Pattern Summary

Always pass an explicit `max_tokens`. Never rely on model defaults.

```typescript
// src/shared/bedrock-limits.ts — import from here, never hardcode locally
export const BEDROCK_MAX_TOKENS = {
  INTENT_CLASSIFICATION:  150,   // "classify order intent" — answer is one word
  ENTITY_EXTRACTION:      300,   // structured JSON extraction from short text
  ATLAS_INSIGHT:          400,   // customer behaviour summary (1-2 sentences)
  MENU_SUGGESTION:        200,   // short list, no prose
  AUDIT_REPORT:           800,   // multi-point structured report
  LONG_FORM_ANALYSIS:    1200,   // rarely needed — require explicit approval
} as const;

export type BedrockTask = keyof typeof BEDROCK_MAX_TOKENS;
```

**Usage:**
```typescript
import { callClaude } from "../../shared/bedrock";
import { BEDROCK_MAX_TOKENS } from "../../shared/bedrock-limits";

const insight = await callClaude({
  system: ATLAS_SYSTEM_PROMPT,
  prompt: buildInsightPrompt(orderHistory),
  maxTokens: BEDROCK_MAX_TOKENS.ATLAS_INSIGHT,
  cacheSystem: true,
});
```

## Full Reference

### Why caps matter
- Output tokens cost 5× input tokens on Sonnet — uncapped generation blows the Lambda budget
- Haiku at 150 tokens costs ~$0.00005 per call. 10K calls/day = $0.50. Uncapped Sonnet = 10× that.
- Enforced cap also forces tighter prompts — a well-scoped prompt needs fewer tokens

### Prompt caching rules
Enable `cacheSystem: true` when:
- System prompt is >1024 tokens (cache break-even)
- The same system prompt is reused across multiple calls in a session
- The call is non-realtime (latency trade-off acceptable)

Do NOT enable for one-shot calls or when system prompt changes per request.

### Hard limits by model (as of 2024)
| Model | Max output |
|-------|-----------|
| claude-3-5-haiku | 8192 |
| claude-3-5-sonnet | 8192 |
| claude-3-opus | 4096 |

Set project caps well below these — never approach model maximums in application code.
