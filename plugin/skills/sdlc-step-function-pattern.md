---
name: sdlc-step-function-pattern
description: Use when designing a multi-step async workflow (checkout, onboarding, document processing) — covers when Step Functions beats chained Lambdas, the state types, and observability.
---

## When to use

- Workflow has > 3 steps with branching, retries, parallel parallel branches
- Steps can fail independently and need different retry policies
- You need a visible state machine for ops to see "where is order X?"
- Long-running (minutes to days)

For 2 sequential Lambda calls: don't bother. For 5+ with branching: yes.

## State types

| State | What |
|---|---|
| **Task** | Calls a Lambda / service |
| **Choice** | Branches based on input |
| **Parallel** | Multiple branches run concurrently |
| **Map** | Iterate over array |
| **Wait** | Pause for time or until timestamp |
| **Pass** | No-op; reshape data |
| **Succeed** / **Fail** | Terminal |

## Pattern — checkout workflow (ASL)

```json
{
  "StartAt": "ValidateCart",
  "States": {
    "ValidateCart": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:::function:validate-cart",
      "Next": "ChargeCustomer",
      "Retry": [{ "ErrorEquals": ["States.TaskFailed"], "MaxAttempts": 2, "BackoffRate": 2 }],
      "Catch": [{ "ErrorEquals": ["States.ALL"], "Next": "ReleaseInventory" }]
    },
    "ChargeCustomer": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:::function:charge-customer",
      "Next": "FulfillOrder",
      "Catch": [{ "ErrorEquals": ["States.ALL"], "Next": "ReleaseInventory" }]
    },
    "FulfillOrder": {
      "Type": "Parallel",
      "Branches": [
        { "StartAt": "SendEmail", "States": { "SendEmail": { ... } } },
        { "StartAt": "NotifyWarehouse", "States": { "NotifyWarehouse": { ... } } }
      ],
      "Next": "Success"
    },
    "ReleaseInventory": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:::function:release-inventory",
      "Next": "Failed"
    },
    "Success": { "Type": "Succeed" },
    "Failed": { "Type": "Fail" }
  }
}
```

## Express vs Standard workflows

| Type | Use for | Notes |
|---|---|---|
| **Standard** | Long-running (> 5 min), durable | Up to 1 year; durable; full history; higher per-exec cost |
| **Express** | Short, high-throughput | < 5 min; lower cost at scale; no per-execution UI history |

Most user-facing flows: Standard. Event-driven backend processing: Express.

## Tasks call patterns

- **Synchronous Lambda invoke**: simplest; Lambda runs, returns, state advances
- **`.sync` integration** (AWS services): waits for the service to complete (e.g. wait for SQS message to be processed)
- **`.waitForTaskToken`**: state pauses; outside system calls back with the token to resume

`.waitForTaskToken` is the trick for human-approval steps (manager approves a refund; click in an email calls back).

## Observability

- Step Functions UI shows the full state graph with current position
- Each execution has a unique ARN; embed it in your logs (`execution_arn`)
- CloudWatch metrics: ExecutionsStarted/Succeeded/Failed/Aborted/TimedOut per state machine

## Anti-patterns

- ❌ Using Step Functions for a 2-step flow (overkill)
- ❌ Putting business logic in the ASL (keep it in Lambdas; ASL orchestrates)
- ❌ No `Catch` on critical steps — failure leaves the workflow stuck
- ❌ No retry policy on flaky external calls
- ❌ Same retry policy for all task types (rate-limit vs network error differ)
- ❌ Passing massive payloads between states (256KB max; use S3 + reference)
- ❌ State name collisions across versions (rename when shape changes)

## Gate criteria

- A state machine is documented with a diagram (Step Functions UI exports this)
- Every Task has explicit Retry and Catch
- Long-running steps use `.waitForTaskToken` rather than polling Lambda
- Payloads stay under 256KB (or pass S3 refs)
- Failed-execution alarm fires on > N failures in 5 min
- A runbook entry covers "stuck workflow at state X" with how to debug + resume
