---
name: sdlc-bedrock-batch-inference
description: Use when processing large volumes of LLM calls that are not interactive (data labeling, classification on archives, bulk summarization) — covers Bedrock batch jobs, cost differences vs streaming, and the input/output format.
---

## When to use

- > 1000 LLM calls that don't need real-time response
- Backfilling historical data
- Periodic batch analysis (daily summarization, weekly classification)
- Cost-sensitive workloads (batch is ~50% cheaper than on-demand)

Don't use for:
- User-facing requests (latency unacceptable)
- < 100 calls (overhead not worth it; just invoke synchronously)

## Pattern — Bedrock batch job

```ts
import { BedrockClient, CreateModelInvocationJobCommand } from "@aws-sdk/client-bedrock";

const client = new BedrockClient({});

await client.send(new CreateModelInvocationJobCommand({
  jobName: `classify-orders-${Date.now()}`,
  modelId: "anthropic.claude-3-5-sonnet-20241022-v2:0",
  roleArn: process.env.BEDROCK_BATCH_ROLE_ARN,
  inputDataConfig: {
    s3InputDataConfig: {
      s3Uri: `s3://${BUCKET}/input/jobs/classify-orders/`,
    },
  },
  outputDataConfig: {
    s3OutputDataConfig: {
      s3Uri: `s3://${BUCKET}/output/jobs/classify-orders/`,
    },
  },
}));
```

## Input file format (JSONL)

Each line is one inference request:

```jsonl
{"recordId": "rec_001", "modelInput": {"anthropic_version": "bedrock-2023-05-31", "max_tokens": 200, "messages": [{"role": "user", "content": "Classify: Order with cancellation request..."}]}}
{"recordId": "rec_002", "modelInput": {"anthropic_version": "bedrock-2023-05-31", "max_tokens": 200, "messages": [{"role": "user", "content": "Classify: Customer asking about refund..."}]}}
```

Each `recordId` is a key you control; the output preserves it so you can join back to your source data.

## Output

Bedrock writes one output JSONL per input file:

```jsonl
{"recordId": "rec_001", "modelOutput": {"content": [{"type": "text", "text": "cancellation_request"}], "usage": {"input_tokens": 25, "output_tokens": 2}}}
{"recordId": "rec_002", "modelOutput": {"content": [{"type": "text", "text": "refund_inquiry"}], "usage": {"input_tokens": 22, "output_tokens": 3}}}
```

## Cost — batch is cheaper

Bedrock batch inference is typically 50% off on-demand pricing. The trade is latency (hours, not seconds).

Compute beforehand:
- (n × input_tokens × batch_rate) + (n × output_tokens × batch_rate)
- vs on-demand: (n × input_tokens × on_demand_rate) + (n × output_tokens × on_demand_rate)

For 1M classifications at 30 input tokens + 2 output tokens, the savings can be hundreds of dollars vs. running interactively.

## Job lifecycle

```
Submitted → InProgress → (Completed | Failed | Stopped)
```

Poll with `GetModelInvocationJobCommand` every 5 min, or subscribe to S3 events for output bucket and react when files appear.

Typical SLA: hours to days for batch. Plan accordingly.

## Idempotency + resumability

- Each input file should be deterministic by content hash — re-running a job that already completed is a no-op (or detect and skip)
- Output should be written to S3 by recordId — easy to dedupe and resume mid-batch

## Anti-patterns

- ❌ Using batch for time-sensitive workflows (latency uncertain — hours)
- ❌ Massive single input file (split into chunks for parallel processing)
- ❌ No `max_tokens` per record (runaway record possible)
- ❌ Mixing models in one job (different rate limits and pricing)
- ❌ Streaming output processing logic that expects ordered records (batch output order is not guaranteed; use recordId)
- ❌ No record-level error handling (one bad input fails the whole job? Or skipped? Check API docs and design accordingly)

## Gate criteria

- Use case justified for batch (volume + non-interactive)
- Input format follows Bedrock JSONL with stable recordIds
- `max_tokens` set per record
- Output processed by recordId, not order
- Cost vs on-demand calculated and documented
- A retry strategy exists for failed jobs (re-submit, partial re-run)
