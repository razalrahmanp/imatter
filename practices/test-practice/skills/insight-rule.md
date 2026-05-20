# insight-rule — Atlas Insight Six-Step Worker Pattern

## Pattern Summary

Every Atlas insight follows this exact pipeline. Do not add steps or skip deduplication.

```typescript
// src/functions/insights/worker.ts

export async function generateInsight(branchId: string, window: "daily" | "weekly"): Promise<void> {
  // Step 1: Load aggregated data — never raw rows
  const stats = await withRls(branchId, async (db) => {
    const { rows } = await db.query<OrderStats>(
      `SELECT
         COUNT(*)               AS total_orders,
         AVG(total)             AS avg_order_value,
         MODE() WITHIN GROUP (ORDER BY status) AS most_common_status
       FROM orders
       WHERE branch_id = $1
         AND created_at >= NOW() - INTERVAL '1 day'
       LIMIT 1`,
      [branchId]
    );
    return rows[0];
  });

  // Step 2: Build prompt — aggregates only, no PII
  const prompt = buildInsightPrompt(stats, window);

  // Step 3: Call Claude — always Sonnet for Atlas insights
  const raw = await callClaude({
    system: ATLAS_SYSTEM_PROMPT,
    prompt,
    maxTokens: BEDROCK_MAX_TOKENS.ATLAS_INSIGHT,
    cacheSystem: true,
  });

  // Step 4: Parse output — validate Claude's response shape
  const parsed = InsightOutputSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    log("error", { action: "insight.parse.fail", errorId: crypto.randomUUID() });
    return;
  }

  // Step 5: Dedup — don't insert if identical insight exists for this window
  const deduped = await deduplicateInsight(branchId, window, parsed.data.text);
  if (!deduped) return;  // identical insight already stored

  // Step 6: Persist — insert new insight row
  await withRls(branchId, async (db) => {
    await db.query(
      "INSERT INTO insights (branch_id, window, text, generated_at) VALUES ($1, $2, $3, NOW())",
      [branchId, window, parsed.data.text]
    );
  });
}
```

## Full Reference

### ATLAS_SYSTEM_PROMPT shape (cached — >1024 tokens)
```
You are Atlas, a business intelligence assistant for tea shop owners.
Your role: analyse operational data and surface concise, actionable insights.
Output: valid JSON matching { "text": string, "confidence": "high"|"medium"|"low" }
Rules:
- One insight per response — not a list
- Maximum 2 sentences
- No customer names, emails, or order-level details
- Confidence: "high" if based on >100 orders, "medium" if 20-100, "low" if <20
```

### Deduplication strategy
```typescript
async function deduplicateInsight(branchId: string, window: string, text: string): Promise<boolean> {
  // Hash the text — if same hash exists for today's window, skip
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
  const { rows } = await withRls(branchId, async (db) =>
    db.query(
      "SELECT id FROM insights WHERE branch_id = $1 AND window = $2 AND text_hash = $3 AND generated_at::date = NOW()::date",
      [branchId, window, hash]
    )
  );
  if (rows.length > 0) return false;  // already exists
  // Store hash with insert (done in step 6)
  return true;
}
```

### Rules
- Aggregates only go to Claude — no row-level data, no customer fields
- Always validate Claude's JSON output with Zod before persisting
- Dedup on text hash + window + date — same insight not repeated within a day
- Insights for all branches fan out via SQS — one message per branch, one Lambda invocation per message
