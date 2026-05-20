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
related: [sqs-trigger, supabase-rls, structured-logging, zod-validation]
---

# lambda-worker — Async Worker Lambda Pattern

## Pattern Summary

Every background worker follows this six-step pattern. No deviation.

```typescript
import { SQSEvent, SQSRecord } from "aws-lambda";
import { verifyInternalToken } from "../../shared/auth";
import { withRls } from "../../shared/db";
import { diagnoseAndThrow } from "../../shared/errors";

export const handler = async (event: SQSEvent): Promise<void> => {
  // 1. Process each record independently — never fail the batch on one record's error
  for (const record of event.Records) {
    await processRecord(record);
  }
};

async function processRecord(record: SQSRecord): Promise<void> {
  // 2. Parse and validate — Zod on every message body
  const body = JSON.parse(record.body);
  const parsed = WorkerMessageSchema.safeParse(body);
  if (!parsed.success) {
    // Log and return — do not throw, SQS will not retry a parse failure
    console.error({ errorId: crypto.randomUUID(), kind: "parse_error", record: record.messageId });
    return;
  }

  const { branchId, payload } = parsed.data;

  // 3. All DB work inside withRls
  try {
    await withRls(branchId, async (db) => {
      // 4. Idempotency check — always check before mutating
      const { rows } = await db.query(
        "SELECT id FROM processed_events WHERE event_id = $1",
        [parsed.data.eventId]
      );
      if (rows.length > 0) return;  // already processed — skip

      // 5. Do the work
      await db.query("INSERT INTO ... VALUES ($1, $2)", [branchId, payload.value]);

      // 6. Mark as processed
      await db.query(
        "INSERT INTO processed_events (event_id, processed_at) VALUES ($1, NOW())",
        [parsed.data.eventId]
      );
    });
  } catch (err) {
    // Re-throw to let SQS retry (respects maxReceiveCount / DLQ)
    console.error({ errorId: crypto.randomUUID(), message: "Worker failed", messageId: record.messageId });
    throw err;
  }
}
```

## Full Reference

### Rules
- Each SQS record processed independently — batch failure ≠ all-fail
- Idempotency guard before every mutation — `event_id` dedup table
- Parse errors: log + return (no retry). Logic errors: throw (let SQS retry + DLQ)
- No PII in logs — no customer order content, email, phone
- `branchId` always from message body (workers have no JWT to verify), validate it's a known branch

### SQS configuration (set in CDK/CloudFormation — not in handler)
- `maxReceiveCount: 3` before DLQ
- `visibilityTimeout` = max handler duration × 6
- DLQ alarm on `ApproximateNumberOfMessagesVisible > 0`

### Forbidden
- `for (const record of records) { await handler(record); }` and throwing at top — fails whole batch
- Bare `pool.query()` without `withRls`
- No idempotency check — retries create duplicate rows
