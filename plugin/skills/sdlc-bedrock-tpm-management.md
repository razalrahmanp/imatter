---
name: sdlc-bedrock-tpm-management
description: Use when an LLM-powered feature is approaching or hitting Bedrock TPM (tokens per minute) limits — covers throttling-defense patterns, quota planning, and the model-routing fallbacks.
---

## What TPM is

Bedrock has per-account, per-region, per-model quotas:

- **TPM (tokens per minute)**: input + output tokens summed
- **RPM (requests per minute)**: total invocations
- **Burst**: short-term peak allowed above sustained TPM

When you exceed either, Bedrock returns `ThrottlingException`. Your code must handle it gracefully.

## Default quotas (rough — check current)

| Model | Default TPM | Default RPM |
|---|---|---|
| Claude Sonnet | 400,000 | 4,000 |
| Claude Haiku | 1,000,000 | 6,000 |
| Claude Opus | 80,000 | 800 |

Quotas vary by region. Increase via AWS service quota request (takes days).

## Rule

Monitor TPM usage. Distribute calls to avoid bursts. Pre-emptively switch to a cheaper/larger-quota model when sustained load grows. Always handle `ThrottlingException` with backoff. Never let one feature consume the whole account quota.

## Pattern — client-side rate limit

```ts
import pLimit from "p-limit";

const limit = pLimit(10);          // max 10 concurrent
const minIntervalMs = 100;          // 10/sec sustained

let lastCallAt = 0;
async function rateLimitedInvoke(prompt: string) {
  return limit(async () => {
    const wait = lastCallAt + minIntervalMs - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastCallAt = Date.now();
    return invokeBedrock(prompt);
  });
}
```

For multi-instance services, use a shared rate-limit (Redis token bucket) — see [[sdlc-rate-limiting]].

## Pattern — handle throttling with backoff

```ts
async function invokeWithBackoff(prompt: string, attempts = 5): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await invokeBedrock(prompt);
    } catch (err) {
      if (err.name === "ThrottlingException" && i < attempts - 1) {
        const backoff = Math.min(30_000, 1000 * 2 ** i);
        const jitter = Math.random() * 1000;
        await sleep(backoff + jitter);
        continue;
      }
      throw err;
    }
  }
  throw new Error("max attempts");
}
```

See [[sdlc-retry-with-backoff]] for general pattern.

## Quota planning

For a feature:

```
Expected QPS × avg_input_tokens × 60 = TPM (input)
Expected QPS × avg_output_tokens × 60 = TPM (output)
Total = sum
```

Pad by 2× for bursts. If the total exceeds account quota: request increase or split workload across regions.

## Per-feature TPM budget

Don't let one feature eat the whole account quota. Allocate:

```ts
// Track per feature
const featureBudget = {
  "intent-classifier": 100_000,   // 25% of total
  "summarizer": 200_000,           // 50%
  "support-chat": 100_000,         // 25%
};
```

Track usage per feature (via metric `llm_input_tokens_total{feature}`). Alert when a feature exceeds 80% of its budget.

## Routing — Sonnet vs Haiku vs Opus

| Model | When |
|---|---|
| **Haiku** | Classification, simple extraction, fast/cheap |
| **Sonnet** | Reasoning, complex extraction, default |
| **Opus** | Highest quality reasoning, sparingly |

If you're throttling on Sonnet, see if some calls can route to Haiku without quality loss. A two-tier strategy (Haiku first, Sonnet fallback on low confidence) cuts Sonnet quota use dramatically.

## Multi-region

Quotas are per-region. If your workload is large, run in 2–3 regions:

- us-east-1, us-west-2, eu-central-1 are common
- Latency from your service to the Bedrock region matters; co-locate

## Anti-patterns

- ❌ No client-side rate limit (your traffic bursts, hits quota, throttling cascade)
- ❌ No backoff on ThrottlingException (instant retry → more throttling)
- ❌ One feature using all the account quota (others starve)
- ❌ No metric per feature (cost source is invisible)
- ❌ Treating Bedrock quotas as static (they grow with usage history; periodic review needed)
- ❌ Asking AWS for huge quota increase up-front before you need it
- ❌ Not having a cheaper-model fallback for non-critical paths

## Gate criteria

- TPM usage per (model, feature) on a dashboard
- Per-feature TPM budgets allocated and tracked
- Throttling rate metric exists; alerts on sustained > 1%
- Backoff implemented on `ThrottlingException`
- A documented strategy for "what if account quota is hit": pause non-critical, switch model, multi-region
- Quota increase requested before sustained usage exceeds 70% of current
