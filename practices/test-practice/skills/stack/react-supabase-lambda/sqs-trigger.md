---
id: sqs-trigger
title: "SQS trigger pattern — Lambda consumer, batch size, visibility timeout, DLQ"
layer: stack
stack: react-supabase-lambda
tags: [sqs, lambda, queue, batch, dlq, aws, event-driven]
applies_to:
  task_types: [add-worker, add-handler]
  stages: [5, 7]
size_tokens: 205
related: [lambda-worker, eventbridge-pattern, structured-logging]
---

# sqs-trigger — SQS Lambda Consumer Pattern

## Pattern Summary

Lambda consuming SQS must handle partial batch failures correctly. A Lambda that throws will retry the entire batch — return partial failures instead.

**SQS configuration (serverless.yml):**
```yaml
functions:
  order-processor:
    handler: src/functions/orders/processor.handler
    events:
      - sqs:
          arn: !GetAtt OrderQueue.Arn
          batchSize: 10
          maximumBatchingWindow: 5      # wait up to 5s to fill batch (reduces invocations)
          functionResponseType: ReportBatchItemFailures  # CRITICAL — partial failure support
    environment:
      QUEUE_URL: !Ref OrderQueue

resources:
  Resources:
    OrderQueue:
      Type: AWS::SQS::Queue
      Properties:
        VisibilityTimeout: 300    # must be >= Lambda timeout * 6
        MessageRetentionPeriod: 86400
        RedrivePolicy:
          deadLetterTargetArn: !GetAtt OrderDlq.Arn
          maxReceiveCount: 3    # 3 attempts before DLQ
    OrderDlq:
      Type: AWS::SQS::Queue
      Properties:
        MessageRetentionPeriod: 1209600   # 14 days
```

**Partial batch failure handler:**
```typescript
import { SQSEvent, SQSBatchResponse } from "aws-lambda";

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: { itemIdentifier: string }[] = [];

  await Promise.allSettled(
    event.Records.map(async (record) => {
      try {
        const body = JSON.parse(record.body);
        await processOrder(body);
      } catch (err) {
        logger.error("sqs_record_failed", { messageId: record.messageId, err });
        failures.push({ itemIdentifier: record.messageId });
      }
    })
  );

  // Only failed records are retried; successful records are deleted from queue
  return { batchItemFailures: failures };
};
```

## Full Reference

### Visibility timeout calculation
Set visibility timeout ≥ Lambda timeout × 6. If Lambda timeout is 30s, visibility timeout must be ≥ 180s. Prevents duplicate processing while Lambda is running.

### Idempotency
SQS delivers at-least-once. Use `message.messageId` as the idempotency key — store in `processed_messages` table before processing, check before acting.

### Forbidden
- Throwing from the handler root (retries entire batch — all successful messages re-processed)
- Setting `batchSize > 1` without `ReportBatchItemFailures` (one failure poisons all others)
- DLQ retention < 7 days (you need time to investigate and replay)
