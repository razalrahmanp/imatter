---
name: sdlc-lambda-worker
description: Use when writing an AWS Lambda function (queue worker, HTTP handler, scheduled job, event consumer) — covers cold start, singleton pattern, error handling, and the configuration that affects reliability.
---

## When to use

- Implementing a new Lambda function for any trigger (API Gateway, SQS, EventBridge, S3, schedule)
- Auditing an existing Lambda for cold start / pool-bloat issues
- Migrating a long-running process into Lambda

## Rule

A Lambda is a stateless function with a warm cache. Initialize heavy clients once per container (singleton pattern), keep handlers small, fail fast on transient errors so retries can pick up the work, and never assume execution will complete (function may be killed at any time).

## Pattern — singleton initialization

```ts
// ✅ MODULE SCOPE — runs once per cold start, cached across warm invocations
import { Client } from "pg";

let dbClient: Client | null = null;
async function getDb(): Promise<Client> {
  if (dbClient) return dbClient;
  dbClient = new Client({ connectionString: process.env.DATABASE_URL });
  await dbClient.connect();
  return dbClient;
}

// The handler — runs every invocation
export const handler = async (event) => {
  const db = await getDb();
  return processEvent(event, db);
};
```

Things that **must** be singletons (heavy to construct):

- DB clients with connection pools
- AWS SDK clients (any from `@aws-sdk/*`)
- Firebase Admin SDK
- SendGrid, Stripe, Razorpay SDKs (lighter, but still cache)
- Secret Manager values (cache for 1–5 minutes; see [[sdlc-secret-handling]])
- Cognito JWT verifiers (cache the JWKS)
- Redis / cache clients

Things that should **not** be singletons:

- Request-specific context
- Transaction objects
- User identity / claims

## Configuration that matters

| Setting | What it controls | Recommended default |
|---|---|---|
| **Memory** | Also scales CPU linearly. More memory = faster cold start + faster execution. | 512 MB to start; tune from metrics. |
| **Timeout** | Max execution duration | 30s for API Gateway (matches API GW max); 15min for workers; lower if you know better. |
| **Reserved concurrency** | Max concurrent executions | Set on critical Lambdas to prevent runaway scaling. |
| **Provisioned concurrency** | Pre-warmed containers | Use for latency-sensitive paths (login, checkout); skip for batch workers. |
| **Architecture** | x86 vs arm64 | arm64 is ~20% cheaper, same speed. Default for new functions. |
| **Tracing** | X-Ray active vs disabled | Active in dev; sample 10% in prod. |
| **Log retention** | CloudWatch retention | 14 days for routine; longer for audit. |

## Handler shape per trigger

### API Gateway

```ts
export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    const body = JSON.parse(event.body ?? "{}");
    const result = await businessLogic(body);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    logger.error("handler failed", { err_message: err.message });
    return { statusCode: 500, body: JSON.stringify({ error: "internal" }) };
  }
};
```

### SQS worker

```ts
export const handler = async (event: SQSEvent) => {
  const failures: { itemIdentifier: string }[] = [];
  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (err) {
      logger.error("record failed", { messageId: record.messageId });
      failures.push({ itemIdentifier: record.messageId });
    }
  }
  return { batchItemFailures: failures }; // partial batch response
};
```

`batchItemFailures` lets successful messages ack while failed ones retry — without this, the whole batch retries.

### EventBridge / scheduled

```ts
export const handler = async (event) => {
  // event = the scheduled trigger payload
  await runScheduledJob();
  // Return value doesn't matter for schedules
};
```

## Error handling

Three categories:

| Type | What to do |
|---|---|
| **User error** (validation, business rule violation) | Return 4xx for API; for queue, log + don't retry (move to DLQ or skip) |
| **Transient infrastructure** (DB timeout, throttling) | Throw; let Lambda fail the invocation; SQS/EventBridge will retry |
| **Programming bug** | Throw; log; debug |

Don't catch-all just to avoid Lambda failure metrics. Failed invocations are *signal*. Hidden errors are bugs that never get fixed.

## DLQ + alarms — set them up for every async trigger

```yaml
# serverless.yml
functions:
  orderWorker:
    handler: src/order-worker.handler
    events:
      - sqs:
          arn: !GetAtt OrderQueue.Arn
          batchSize: 10

resources:
  Resources:
    OrderQueue:
      Type: AWS::SQS::Queue
      Properties:
        QueueName: orders
        RedrivePolicy:
          deadLetterTargetArn: !GetAtt OrderQueueDLQ.Arn
          maxReceiveCount: 5
    OrderQueueDLQ:
      Type: AWS::SQS::Queue
      Properties:
        QueueName: orders-dlq
        MessageRetentionPeriod: 1209600    # 14 days
```

Alarm on `ApproximateNumberOfMessagesVisible` in the DLQ > 0. A non-zero DLQ means messages need human attention.

## Cold start mitigation

Cold start = first invocation after container creation. ~100–500ms for Node.js. For latency-sensitive paths:

1. **Provisioned Concurrency** (paid; pre-warmed) for the critical handler.
2. **Init optimizations**:
   - Lazy-init clients only when used (not all clients in every handler)
   - Bundle with esbuild/tsc → smaller package → faster init
   - Avoid heavy SDK imports if a lightweight alternative exists
   - Use `arm64` (faster start than x86 in most measurements)
3. **Connection reuse**: AWS SDK v3 reuses HTTP connections automatically — don't disable it.

## Anti-patterns

- ❌ Initializing DB client inside the handler (every invocation = new connection = pool blowout)
- ❌ Storing state in module-scope variables expecting persistence (containers come and go)
- ❌ `sync` calls (file system, etc.) that block the event loop
- ❌ Looping forever / not returning (timeout kills the function and you lose the work)
- ❌ Catching all errors to "make Lambda metrics clean" — hides bugs
- ❌ No DLQ on async triggers — failures silently lost
- ❌ Reserved concurrency = 0 by mistake (kills the function)
- ❌ One Lambda doing everything (god-handler; hard to deploy / scale / observe)

## Gate criteria

- Heavy clients are initialized at module scope (singleton), not per invocation
- Timeout, memory, concurrency configured deliberately (not all defaults)
- Async triggers (SQS, EventBridge) have a DLQ with an alarm at depth > 0
- Logs structured ([[sdlc-structured-logging]]) with `request_id` for correlation
- No business logic in the handler itself — extract into testable functions
- Cold start time measured and tuned for latency-sensitive paths
- A runbook entry exists ([[sdlc-runbook-pattern]]) for "DLQ has messages"
