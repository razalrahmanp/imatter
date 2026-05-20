---
id: ai-human-oversight
title: "EU AI Act human oversight — Article 14 stop/override for high-risk AI"
layer: compliance
compliance_module: eu-ai-act
tags: [eu-ai-act, human-oversight, article-14, high-risk, override, compliance]
applies_to:
  task_types: [add-feature, add-worker, add-handler, add-component]
  stages: [3, 5, 6]
size_tokens: 205
related: [ai-risk-classification, ai-system-logging, ai-transparency-disclosure]
---

# ai-human-oversight — EU AI Act Human Oversight Pattern (Art. 14)

## Pattern Summary

High-risk AI systems must be designed so a human can understand, monitor, and override outputs before they cause harm. Automation alone is insufficient — the human must have a genuine override path.

**Art. 14 oversight requirements:**
```
1. Deployers must assign competent natural persons to oversee the system
2. Human overseers must be able to:
   a. Understand the system's capabilities and limitations
   b. Monitor for anomalous operation
   c. Detect and correct failures / bias / risks
   d. STOP the system or disengage it (kill switch or human-approval gate)
3. If the system cannot be monitored during use (fully automated), provide
   post-hoc review capability before irreversible actions are taken
```

**Human-approval gate pattern:**
```typescript
// For high-risk decisions: do not act until a human approves
async function queueForHumanReview(
  decision: AiDecision,
  branchId: string,
  reviewerRole: "owner" | "admin"
): Promise<ReviewTicket> {
  const ticket: ReviewTicket = {
    id: crypto.randomUUID(),
    ai_log_id: decision.logId,
    system_name: decision.systemName,
    recommended_action: decision.output,
    confidence: decision.confidence,
    status: "pending_review",
    created_at: new Date().toISOString(),
    branch_id: branchId,
    reviewer_role_required: reviewerRole,
  };
  await db.query(
    "INSERT INTO ai_review_queue VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    Object.values(ticket)
  );
  return ticket;
}

// Human confirms or overrides — log the outcome either way
async function resolveReview(
  ticketId: string, reviewerId: string, approved: boolean, overrideReason?: string
): Promise<void> {
  await db.query(
    "UPDATE ai_review_queue SET status=$2, reviewer_id=$3, approved=$4, override_reason=$5, resolved_at=NOW() WHERE id=$1",
    [ticketId, "resolved", reviewerId, approved, overrideReason ?? null]
  );
}
```

## Full Reference

### Kill-switch requirement
Every high-risk AI pipeline must have an operator-accessible disable switch. For Lambda-based systems: use a feature flag (`FLAGS.SYSTEM_NAME_ENABLED`). When disabled, the pipeline returns a `feature_disabled` response and queues work for manual processing.

### Oversight responsibility allocation
Document which role is responsible for oversight in your `AiSystemRecord`. Staff cannot oversee employment-related AI systems — must be owner or admin.

### Forbidden
- Fully automated high-risk decisions with no human-review step before irreversible action
- Kill switches that require code deployment to activate — must be operational at runtime
- Logging oversight outcomes in free-text fields — use structured schema for audit
