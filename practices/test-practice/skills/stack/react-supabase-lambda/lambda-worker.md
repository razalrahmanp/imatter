---
id: lambda-worker
title: "Lambda worker — six-step async pattern"
layer: stack
stack: react-supabase-lambda
tags: [aws, lambda, worker, sqs, async, idempotency]
applies_to:
  task_types: [add-worker, modify-worker, debug-worker, add-queue-consumer]
  stages: [5, 7, 9]
size_tokens: 320
related: [supabase-rls, structured-logging, input-validation]
---

# lambda-worker — Async Worker Lambda Pattern

## Pattern Summary

Every background worker follows this six-step pattern. No deviation.

```typescript
export const handler = async (event: SQSEvent): Promise<void> => {
  // 1. Process each record independently — never fail the batch on one record's error
  for (const record of event.Records) await processRecord(record);
};

async function processRecord(record: SQSRecord): Promise<void> {
  // 2. Parse and validate — Zod on every message body
  const parsed = WorkerMessageSchema.safeParse(JSON.parse(record.body));
  if (!parsed.success) {
    console.error({ errorId: crypto.randomUUID(), kind: "parse_error", messageId: record.messageId });
    return;  // log and return — do not throw, SQS will not retry a parse failure
  }
  const { branchId, eventId, payload } = parsed.data;

  // 3. All DB work inside withRls
  try {
    await withRls(branchId, async (db) => {
      // 4. Idempotency check — always check before mutating
      const { rows } = await db.query("SELECT id FROM processed_events WHERE event_id = $1", [eventId]);
      if (rows.length > 0) return;  // already processed — skip

      // 5. Do the work
      await db.query("INSERT INTO ...", [branchId, payload.value]);

      // 6. Mark as processed
      await db.query("INSERT INTO processed_events (event_id, processed_at) VALUES ($1, NOW())", [eventId]);
    });
  } catch (err) {
    console.error({ errorId: crypto.randomUUID(), message: "Worker failed", messageId: record.messageId });
    throw err;  // re-throw to let SQS retry (respects maxReceiveCount / DLQ)
  }
}
```

**Rules:**
- Each SQS record processed independently — batch failure ≠ all-fail
- Parse errors: log + return (no retry). Logic errors: throw (SQS retry + DLQ)
- Idempotency guard before every mutation — `event_id` dedup table
- No PII in logs

## Full Reference

### SQS configuration (set in CDK/IaC — not in handler)
- `maxReceiveCount: 3` before DLQ
- `visibilityTimeout` = max handler duration × 6
- DLQ alarm on `ApproximateNumberOfMessagesVisible > 0`

### Forbidden
- Throwing at the top-level `handler` (fails whole batch)
- Bare `pool.query()` without `withRls`
- No idempotency check — retries create duplicate rows
