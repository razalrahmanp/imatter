---
name: sdlc-agent-response-contract
description: Use when integrating an AI agent's output into application code (chat replies, tool calls, structured extraction) — establishes the shape contract, validation, and what to do when the agent breaks the contract.
---

## Rule

An AI agent's output is untrusted external data, like any other API. Define a strict schema for what the agent must return, validate every output against it, and have a documented fallback when validation fails. Never let unvalidated agent output reach a user or trigger side effects.

## Pattern — schema-first

```ts
import { z } from "zod";

const SupportReplySchema = z.object({
  reply: z.string().max(2000),
  intent: z.enum(["question", "complaint", "compliment", "escalation"]),
  confidence: z.number().min(0).max(1),
  suggested_next_action: z.enum(["resolve", "escalate", "follow_up"]).optional(),
  references: z.array(z.object({
    kb_id: z.string(),
    title: z.string(),
  })).optional(),
});

type SupportReply = z.infer<typeof SupportReplySchema>;
```

This is the contract. Both the prompt (with tool-use schema) and validation reference it.

## Tool use — let the model fill the schema

```ts
const result = await llm.generate({
  systemPrompt: "...",
  userPrompt: customerMessage,
  toolSchema: {
    name: "respond_to_customer",
    description: "Respond to the customer's message",
    input_schema: SupportReplySchema,  // converted to JSON Schema
  },
});

// Parse and validate
const validated = SupportReplySchema.safeParse(result.toolInput);
if (!validated.success) {
  // Contract broken — fall back
  return fallbackResponse(customerMessage, validated.error);
}
return validated.data;
```

## When the contract breaks

Models occasionally produce off-schema output. Plan for it:

| Failure mode | What to do |
|---|---|
| Missing required field | Retry once with a "follow the schema" prompt; if fails, use deterministic fallback |
| Extra field | Strip it; otherwise pass |
| Wrong enum value | Map to nearest allowed; or fallback |
| Type mismatch (string in number field) | Reject; retry or fallback |
| Empty response / refusal | Show user a "please rephrase" UI message |
| Hallucinated reference (e.g. fake kb_id) | Validate references against your DB; remove unknown ones |

The fallback is determined by the feature:
- Chat reply: show a generic "I'm not sure how to help" message + escalation option
- Classification: skip the record, surface "needs human review"
- Summarization: use a deterministic extractive fallback or skip

## Confidence as a routing signal

If your schema includes `confidence`, use it:

```ts
if (result.confidence < 0.7) {
  // Don't auto-act; surface for human review
  return queueForHumanReview(customerMessage, result);
}
```

Calibrate the threshold against actual outcomes. A model that says 0.9 confidence and is wrong 30% of the time means the threshold is meaningless — recalibrate.

## Reference validation — anti-hallucination

If the agent cites sources (kb_id, document_id), verify they exist:

```ts
const validReferences = await Promise.all(
  result.references.map(async ref => {
    const exists = await db.kb_articles.findById(ref.kb_id);
    return exists ? ref : null;
  })
);
const cleaned = validReferences.filter(Boolean);
```

Hallucinated references are a top failure mode in RAG / support chat. Strip them.

## What the contract does NOT enforce

- Truthfulness — the model can return a syntactically valid lie
- Helpfulness — a valid response can be useless
- Safety — toxicity, bias still need separate checks

Validation is the floor, not the ceiling.

## Anti-patterns

- ❌ No schema validation (assume the model returns what you asked for)
- ❌ No fallback when validation fails (user sees an error)
- ❌ Different contract per call site (model-output handling spread thinly)
- ❌ Trusting agent output to determine authorization (see [[sdlc-prompt-injection-defense]])
- ❌ References that aren't validated against ground truth
- ❌ Logging the raw agent output without redaction (may contain PII echoed from user input)
- ❌ Using `JSON.parse` on a JSON string from the agent without try/catch
- ❌ Streaming agent output directly to the user without buffering for safety/format checks

## Gate criteria

- Every agent integration has a Zod (or equivalent) schema for output
- Output is validated; mismatches logged and rerouted to fallback
- A documented fallback exists for every contract failure mode
- References / citations are validated against ground truth
- Confidence signal (if present) is calibrated and used in routing
- Metrics track schema-mismatch rate per agent integration
- Tests cover the contract-break cases (mock the model returning bad shape; verify fallback fires)
