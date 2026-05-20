---
id: rabos-event-shape
title: "RABOS event shape — internal event envelope, source tagging"
layer: project
project: rabos
tags: [rabos, events, eventbridge, envelope, schema, source-tagging]
applies_to:
  task_types: [add-worker, add-event, modify-event, add-handler]
  stages: [5, 7]
size_tokens: 210
related: [lambda-worker, input-validation, structured-logging]
---

# rabos-event-shape — Internal Event Envelope

## Pattern Summary

Every internal domain event follows the same envelope. No event is published without going through the event builder.

```typescript
// The canonical RABOS event envelope
interface RabosEvent<T = unknown> {
  event_id:    string;          // crypto.randomUUID() — for idempotency
  event_type:  string;          // "{domain}.{action}" e.g. "orders.created"
  schema_version: number;       // increment when payload shape changes
  source:      string;          // emitting Lambda function name (process.env.AWS_LAMBDA_FUNCTION_NAME)
  branch_id:   string;          // tenant scope — always present
  occurred_at: string;          // ISO 8601 timestamp
  payload:     T;               // domain-specific data
}

// Build and publish via the event builder — never construct raw
import { publishEvent } from "../../shared/events";

await publishEvent({
  event_type: "orders.created",
  branch_id: branchId,
  payload: { order_id: order.id, table_id: order.table_id, total: order.total },
});
// publishEvent sets event_id, source, occurred_at, schema_version automatically
```

**Source tagging is automatic.** `publishEvent` reads `process.env.AWS_LAMBDA_FUNCTION_NAME`. Never pass `source` manually — it must reflect the actual emitting function, not a hand-written string.

**Payload rules:**
- No PII in payload — order contents, table IDs, totals are OK; customer names/emails are not
- Payload must be JSON-serializable — no class instances, no circular refs
- `schema_version` increments when the payload shape changes (consumers use it to handle old events)

## Full Reference

### Event naming convention
`"{domain}.{past_tense_verb}"` — `orders.created`, `payments.confirmed`, `menu.updated`, `branch.settings_changed`

### Idempotency — consumers use `event_id`
Every consumer checks `processed_events` table before acting. `event_id` is the dedup key.

### Schema version migration
When adding a required field to a payload:
1. Add as optional first (schema_version unchanged)
2. After all consumers handle optional field: make required, increment schema_version
3. Keep consumer handling for old schema_version alive until all old events have expired

### Forbidden
- Publishing events with customer email, phone, or full name in payload
- Constructing `RabosEvent` directly instead of using `publishEvent`
- Hardcoding `source` field
