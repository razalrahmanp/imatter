---
id: eventbridge-pattern
title: "EventBridge pattern — custom bus, rule routing, DLQ, retry policy"
layer: stack
stack: react-supabase-lambda
tags: [eventbridge, events, aws, event-driven, dlq, routing]
applies_to:
  task_types: [add-event, add-worker, add-handler]
  stages: [5, 7]
size_tokens: 210
related: [lambda-worker, sqs-trigger, structured-logging]
---

# eventbridge-pattern — EventBridge Event Routing Pattern

## Pattern Summary

Use a custom EventBridge bus for all internal domain events. Route by `detail-type` to target Lambdas. Always attach a DLQ to the rule target — failed events must not silently disappear.

**Custom bus setup (serverless.yml):**
```yaml
resources:
  Resources:
    RabosEventBus:
      Type: AWS::Events::EventBus
      Properties:
        Name: rabos-events-${sls:stage}
```

**Rule routing by event type:**
```yaml
# Route "orders.created" to kitchen-notifier Lambda
OrderCreatedRule:
  Type: AWS::Events::Rule
  Properties:
    EventBusName: !Ref RabosEventBus
    EventPattern:
      detail-type: ["orders.created"]
    Targets:
      - Id: KitchenNotifierTarget
        Arn: !GetAtt KitchenNotifierLambdaFunction.Arn
        DeadLetterConfig:
          Arn: !GetAtt EventsDlq.Arn
        RetryPolicy:
          MaximumRetryAttempts: 3
          MaximumEventAgeInSeconds: 3600
```

**Publishing events (use the shared event builder — see rabos-event-shape):**
```typescript
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";

const eb = new EventBridgeClient({});

export async function publishEvent(event: Omit<RabosEvent, "event_id" | "source" | "occurred_at">): Promise<void> {
  await eb.send(new PutEventsCommand({
    Entries: [{
      EventBusName: process.env.EVENT_BUS_NAME,
      Source: "rabos." + event.event_type.split(".")[0],
      DetailType: event.event_type,
      Detail: JSON.stringify({
        ...event,
        event_id: crypto.randomUUID(),
        source: process.env.AWS_LAMBDA_FUNCTION_NAME,
        occurred_at: new Date().toISOString(),
      }),
    }],
  }));
}
```

## Full Reference

### DLQ monitoring
Set a CloudWatch alarm on `NumberOfMessagesSent` for the DLQ. Any message reaching the DLQ means a consumer Lambda failed all retries — page immediately.

### Idempotency in consumers
EventBridge guarantees at-least-once delivery. Consumers must be idempotent: check `processed_events` table for `event_id` before acting.

### Forbidden
- Routing all events to one Lambda that then re-dispatches internally (defeats the bus pattern)
- Rule targets without a DLQ — failed events are silently dropped
- Publishing events without `branch_id` in the detail (breaks tenant isolation downstream)
