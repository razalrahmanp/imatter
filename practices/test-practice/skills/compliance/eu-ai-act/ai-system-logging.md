---
id: ai-system-logging
title: "EU AI Act AI system logging — Article 12 automatic logs for high-risk systems"
layer: compliance
compliance_module: eu-ai-act
tags: [eu-ai-act, logging, high-risk, article-12, audit-trail, compliance]
applies_to:
  task_types: [add-worker, add-handler, add-integration]
  stages: [5, 7, 10]
size_tokens: 210
related: [ai-risk-classification, ai-human-oversight, structured-logging, audit-logging]
---

# ai-system-logging — EU AI Act System Logging (Art. 12)

## Pattern Summary

High-risk AI systems must automatically generate logs enabling post-hoc auditability. Logs must be retained for the period specified in Art. 12 — at minimum as long as the system is in use, typically 5 years for most Annex III systems.

**Mandatory log fields for high-risk AI:**
```typescript
interface AiSystemLog {
  log_id:          string;    // crypto.randomUUID()
  system_name:     string;    // registered system name
  system_version:  string;
  session_id?:     string;    // if stateful interaction
  input_summary:   string;    // describe input WITHOUT PII — e.g. "invoice_count=12, period=Q1"
  output_summary:  string;    // describe output — e.g. "flagged=true, risk_score=0.87"
  decision_made:   boolean;   // true if system output directly drove an action
  human_reviewed:  boolean;   // was a human in the loop before action taken?
  human_reviewer?: string;    // user ID if human_reviewed = true
  model_id:        string;    // e.g. "amazon.nova-pro-v1:0"
  latency_ms:      number;
  occurred_at:     string;    // ISO 8601
  branch_id:       string;    // tenant scope
}
```

**Logging wrapper for Bedrock calls (high-risk):**
```typescript
async function invokeHighRiskAi(
  input: Record<string, unknown>,
  systemName: string,
  branchId: string
): Promise<{ output: unknown; logId: string }> {
  const logId = crypto.randomUUID();
  const start = Date.now();

  const output = await bedrock.invoke(input);

  await logAiDecision({
    log_id: logId, system_name: systemName, system_version: AI_SYSTEM_VERSION,
    input_summary: summariseInputWithoutPii(input),
    output_summary: summariseOutput(output),
    decision_made: true,
    human_reviewed: false,
    model_id: MODEL_ID,
    latency_ms: Date.now() - start,
    occurred_at: new Date().toISOString(),
    branch_id: branchId,
  });

  return { output, logId };
}
```

## Full Reference

### Retention periods
Art. 12(1): logs retained for period appropriate to intended purpose. Annex III employment/credit systems: regulators expect 5 years minimum. Store in a write-once log store (S3 with Object Lock, or append-only DB table).

### What "input summary" means
Do not log raw input — it likely contains PII. Log structural metadata: field counts, value ranges, category labels. Never log customer name, email, or national ID in AI logs.

### Forbidden
- Logging raw PII in `input_summary` or `output_summary`
- Mutable AI logs — use append-only storage, no UPDATE/DELETE
- Omitting logging for high-risk AI on the grounds that "the model is the same as before"
