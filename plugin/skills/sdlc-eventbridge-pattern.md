---
name: sdlc-eventbridge-pattern
description: Use when designing an event-driven system on AWS EventBridge (custom event bus, schemas, rules, targets) — covers schema-first design, the dead-letter pattern, and how to keep events queryable as the system grows.
---

## Rule

EventBridge is an event router. Events have schemas (versioned), rules subscribe to events by pattern, targets receive matching events. Design schemas first, treat events as a public API, and instrument both producer and consumer sides.

## Pattern — schema-first event

```json
{
  "version": "1",
  "id": "evt_01H...",
  "detail-type": "OrderPlaced",
  "source": "orders-service",
  "time": "2026-05-20T10:30:00Z",
  "detail": {
    "order_id": "ord_abc123",
    "tenant_id": "tnt_xyz",
    "customer_id": "usr_def",
    "total_paise": 50000,
    "currency": "INR",
    "placed_at": "2026-05-20T10:30:00Z",
    "schema_version": 1
  }
}
```

Define the schema once (JSON Schema, Pydantic, Zod). Publishers validate before publishing. Consumers validate on receive. Both reject malformed events.

## Schema versioning

Events are a public API. Don't break them silently.

- **Additive changes** (new optional field): bump minor version in `schema_version`. Old consumers ignore the new field.
- **Breaking changes**: ship as a new `detail-type` (e.g. `OrderPlacedV2`). Run both for a transition period. Deprecate old after consumers migrate.

## Rule patterns

```json
{
  "source": ["orders-service"],
  "detail-type": ["OrderPlaced"]
}
```

```json
{
  "source": [{ "prefix": "orders-" }],
  "detail-type": ["OrderPlaced", "OrderCancelled"],
  "detail": {
    "tenant_id": ["tnt_xyz"]
  }
}
```

Keep patterns specific. A rule that matches "all events from orders-service" is a recipe for accidental cross-flow contamination.

## Targets — with DLQ

Every target should have a DLQ in case the consumer fails:

```yaml
Rule:
  Type: AWS::Events::Rule
  Properties:
    EventPattern: '{"source":["orders-service"], "detail-type":["OrderPlaced"]}'
    Targets:
      - Arn: !GetAtt EmailWorker.Arn
        Id: email-worker
        DeadLetterConfig:
          Arn: !GetAtt EmailWorkerDLQ.Arn
        RetryPolicy:
          MaximumRetryAttempts: 5
          MaximumEventAgeInSeconds: 3600
```

Alarm on DLQ depth > 0. Same pattern as SQS ([[sdlc-sqs-trigger]]).

## Consumer side — idempotency

EventBridge is at-least-once. The same event may be delivered twice. Consumers use the event `id` as an idempotency key:

```ts
async function handleOrderPlaced(event: EventBridgeEvent<"OrderPlaced", OrderPlacedDetail>) {
  try {
    await db.event_log.insert({ event_id: event.id, source: event.source });
  } catch (err) {
    if (isUniqueViolation(err)) return; // already processed
    throw err;
  }
  await sendOrderConfirmationEmail(event.detail);
}
```

See [[sdlc-idempotency-keys]] for the broader pattern.

## Replay

EventBridge supports archive + replay. Useful for:

- Recovering after a consumer bug ate events
- Backfilling a new consumer with historical events
- Disaster recovery

Set up an archive at the bus level. Replay sends archived events through the rules again — make sure consumers are idempotent (or the replay will double-execute).

## Observability

For each rule, track:

- `Invocations` (how many events matched and were sent)
- `FailedInvocations` (target rejected)
- `DeadLetterInvocations` (after retries exhausted, went to DLQ)

Dashboards: events-per-second by source/detail-type. Errors-per-second by rule.

## Producer side — log what you publish

```ts
await eb.send(new PutEventsCommand({ Entries: [event] }));
logger.info("event published", {
  event_id: event.id,
  event_type: event.detail-type,
  source: event.source,
  // don't log detail body if it has PII
});
```

## Anti-patterns

- ❌ Loose schemas — events with whatever fields the producer happened to include
- ❌ Breaking changes to event shape without versioning
- ❌ One mega-event ("EntityChanged") with a "type" field — defeats EventBridge pattern matching
- ❌ Producer side fires-and-forgets without verifying publish succeeded
- ❌ No DLQ on the target — failed deliveries lost
- ❌ Consumer not idempotent (double delivery → double effect)
- ❌ Catching all errors in consumer to "keep metrics clean" (failures hidden)
- ❌ Subscribing to every event (`{"source": [{"prefix":""}]}`) — performance + cost
- ❌ Treating EventBridge as a queue (it's a router; use SQS for queueing semantics)

## Gate criteria

- Every event type has a documented schema with version
- Producers validate against the schema before publishing
- Every rule has a DLQ configured
- Every target consumer is idempotent on event id
- Archive set up on critical event buses
- Dashboards exist for invocations, failures, DLQ depth
- A schema change process is documented (when to bump version, when to introduce new detail-type)
