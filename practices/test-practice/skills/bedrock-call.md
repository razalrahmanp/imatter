# bedrock-call — Bedrock Claude Invocation Pattern

## Pattern Summary

All Claude API calls in this project use this wrapper. Never call Bedrock directly.

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

interface BedrockCallOptions {
  system: string;           // Always include — anchors the task
  prompt: string;           // User turn only — no role-play setup here
  maxTokens: number;        // Always explicit — see bedrock-max-tokens skill
  cacheSystem?: boolean;    // Set true when system prompt is > 1024 tokens and reused
}

export async function callClaude(opts: BedrockCallOptions): Promise<string> {
  const messages = [{ role: "user", content: opts.prompt }];

  const systemBlock = opts.cacheSystem
    ? [{ text: opts.system, cachePoint: { type: "default" } }]  // prompt caching
    : [{ text: opts.system }];

  const body = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: opts.maxTokens,
    system: systemBlock,
    messages,
  };

  const cmd = new InvokeModelCommand({
    modelId: "anthropic.claude-3-5-haiku-20241022-v1:0",  // default — override for Atlas
    body: JSON.stringify(body),
    contentType: "application/json",
    accept: "application/json",
  });

  const response = await bedrock.send(cmd);
  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.content[0].text as string;
}
```

**Model routing by task:**
| Task | Model | maxTokens |
|------|-------|-----------|
| Intent classification | claude-3-5-haiku | 150 |
| Atlas insight generation | claude-3-5-sonnet | 400 |
| Structured extraction | claude-3-5-haiku | 300 |
| Audit / long analysis | claude-3-opus | 800 |

## Full Reference

### Batch inference — for non-realtime jobs
```typescript
// Use CreateModelInvocationJob for batch — never fan-out 100 Lambda invocations
const batchJob = await bedrock.send(new CreateModelInvocationJobCommand({
  modelId: "...",
  inputDataConfig: { s3InputDataConfig: { s3Uri: "s3://..." } },
  outputDataConfig: { s3OutputDataConfig: { s3Uri: "s3://..." } },
}));
```

### Error handling
```typescript
try {
  return await callClaude(opts);
} catch (err: unknown) {
  if ((err as { name?: string }).name === "ThrottlingException") {
    // Exponential backoff — do not retry in a tight loop
    throw err;
  }
  console.error({ errorId: crypto.randomUUID(), message: "Bedrock call failed" });
  throw err;
}
```

### Forbidden
- `max_tokens` omitted — Bedrock defaults are too high, drives up cost
- Logging `opts.prompt` — may contain customer order content (PII)
- Calling Bedrock from frontend — always proxy through Lambda
