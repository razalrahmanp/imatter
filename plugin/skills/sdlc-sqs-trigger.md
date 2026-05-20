---
name: sdlc-sqs-trigger
description: Use when implementing a Lambda or worker triggered by AWS SQS — covers visibility timeout, batch size, partial batch response, and the DLQ pattern.
---

## Rule

SQS-triggered Lambdas are at-least-once delivery. Design for redelivery: every message handler is idempotent, partial batch failures use `batchItemFailures`, every queue has a DLQ with depth alarms, and visibility timeout is configured to match real processing time.

## Pattern — partial batch response

```ts
export const handler = async (event: SQSEvent) => {
  const failures: { itemIdentifier: string }[] = [];

  await Promise.all(event.Records.map(async (record) => {
    try {
      await processMessage(JSON.parse(record.body));
    } catch (err) {
      logger.error("message failed", { messageId: record.messageId, err_message: err.message });
      failures.push({ itemIdentifier: record.messageId });
    }
  }));

  return { batchItemFailures: failures };
};
```

Without `batchItemFailures`, one bad message in a batch of 10 retries the *whole* batch — 9 messages get processed twice. With it, only the failed ones retry.

## Configuration that matters

| Setting | What | How to choose |
|---|---|---|
| **Visibility timeout** | How long the message is hidden after a worker picks it up | 6 × longest expected processing time (covers slow days + retries) |
| **Batch size** | Messages per Lambda invocation | 1 for safety-critical; 10 for routine; up to 10000 for FIFO heavy throughput |
| **Maximum batch window** | Wait before triggering | 5s default; longer = better batching, higher latency |
| **Maximum receive count** | Retries before DLQ | 5 typical; higher for transient-prone work |
| **Reserved concurrency** | Cap concurrent invocations | Set if downstream has limits |

## Idempotency — non-negotiable

SQS may deliver the same message more than once. Every handler must be safe to process the same message twice.

Use the message body's unique ID + an `idempotency_keys` table ([[sdlc-idempotency-keys]]):

```ts
async function processMessage(msg: { id: string; payload: any }) {
  try {
    await db.idempotency_keys.insert({ key: msg.id, route: "sqs.orders" });
  } catch (err) {
    if (isUniqueViolation(err)) {
      logger.info("duplicate; skipping", { messageId: msg.id });
      return;
    }
    throw err;
  }
  // ... do the work
}
```

## DLQ — mandatory

```yaml
OrderQueue:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: orders
    VisibilityTimeout: 300
    RedrivePolicy:
      deadLetterTargetArn: !GetAtt OrderQueueDLQ.Arn
      maxReceiveCount: 5

OrderQueueDLQ:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: orders-dlq
    MessageRetentionPeriod: 1209600  # 14 days
```

Alarm on `ApproximateNumberOfMessagesVisible` > 0 in DLQ. A non-empty DLQ = humans need to investigate.

## FIFO vs standard

| Type | When | Notes |
|---|---|---|
| **Standard** | Throughput; most workloads | At-least-once; no ordering guarantee |
| **FIFO** | Strict ordering required per group | At-most-once with deduplication; lower throughput |

Pick standard unless you specifically need FIFO. FIFO's throughput limits (300/sec per queue without HighThroughputFifo) bite at scale.

## Visibility timeout — the most common bug

If processing takes longer than the visibility timeout, the message becomes visible again — and another worker picks it up. Now two workers are processing the same message. If the work isn't idempotent, this is a duplicate operation.

Set visibility timeout to **at least 6× the p99 processing time**. Or extend it explicitly during long work using `ChangeMessageVisibility`.

## Anti-patterns

- ❌ Processing not idempotent (duplicate messages cause duplicate side effects)
- ❌ No `batchItemFailures` (one failure poisons the whole batch)
- ❌ No DLQ (failures lost forever; debug nightmare)
- ❌ Visibility timeout too short (re-delivery during long jobs → duplicate work)
- ❌ Batch size 1 on a high-throughput queue (Lambda cost explodes)
- ❌ Logging the entire message body (PII risk; volume)
- ❌ Catching all errors to "keep Lambda metrics clean" (hides bugs; messages go to oblivion)
- ❌ Recursive triggers (Lambda producing back to the same queue without rate limits)

## Gate criteria

- Handler implements partial batch response (`batchItemFailures`)
- Processing is idempotent (message ID → idempotency table)
- DLQ exists with alarm at depth > 0
- Visibility timeout configured to ≥ 6× p99 processing time
- Reserved concurrency set if downstream has limits
- A runbook ([[sdlc-runbook-pattern]]) exists for "DLQ has messages" with diagnose + mitigate steps
