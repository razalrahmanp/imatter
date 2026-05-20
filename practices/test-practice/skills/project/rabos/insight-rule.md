---
id: insight-rule
title: "Atlas insight — six-step pipeline, dedup, Claude template"
layer: project
project: rabos
tags: [rabos, atlas, ai, insight, bedrock, dedup, claude]
applies_to:
  task_types: [add-insight, modify-insight, add-atlas-rule]
  stages: [3, 7, 9]
size_tokens: 310
related: [bedrock-call, bedrock-max-tokens, supabase-rls, pii-handling]
---

# insight-rule — Atlas Insight Six-Step Worker Pattern

## Pattern Summary

Every Atlas insight follows this exact pipeline. Do not add steps or skip deduplication.

```
Step 1: Load aggregated data       — withRls, aggregate query, never raw rows
Step 2: Build prompt               — counts + stats only, no PII
Step 3: Call Claude (Sonnet)       — BEDROCK_MAX_TOKENS.ATLAS_INSIGHT, cacheSystem: true
Step 4: Parse and validate output  — Zod schema on Claude's JSON response
Step 5: Dedup                      — text hash + window + date, skip if exists
Step 6: Persist                    — INSERT INTO insights
```

```typescript
// Step 3 — always Sonnet for Atlas, always explicit max_tokens
const raw = await callClaude({
  system: ATLAS_SYSTEM_PROMPT,
  prompt: buildInsightPrompt(stats),   // stats = aggregate counts, not row-level
  maxTokens: BEDROCK_MAX_TOKENS.ATLAS_INSIGHT,
  cacheSystem: true,
});

// Step 4 — validate Claude's response shape before persisting
const parsed = InsightOutputSchema.safeParse(JSON.parse(raw));
if (!parsed.success) { log("error", { action: "insight.parse.fail", errorId: crypto.randomUUID() }); return; }

// Step 5 — dedup by text hash + window + date
const hash = crypto.createHash("sha256").update(parsed.data.text).digest("hex").slice(0, 16);
const { rows } = await withRls(branchId, (db) =>
  db.query("SELECT id FROM insights WHERE branch_id = $1 AND window = $2 AND text_hash = $3 AND generated_at::date = NOW()::date",
    [branchId, window, hash])
);
if (rows.length > 0) return;  // identical insight already stored today
```

**ATLAS_SYSTEM_PROMPT shape (cached — always > 1024 tokens):**
- Role: business intelligence assistant for tea shop owners
- Output: `{ "text": string, "confidence": "high"|"medium"|"low" }`
- One insight per response, max 2 sentences, no customer names or order details
- Confidence: high > 100 orders, medium 20–100, low < 20

## Full Reference

### Rules
- Aggregates only go to Claude — no row-level data, no customer fields
- Always validate Claude's JSON output with Zod before persisting
- Dedup on text hash + window + date — same insight not repeated within a day
- Fan-out via SQS — one message per branch, one Lambda invocation per message
