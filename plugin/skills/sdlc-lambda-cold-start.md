---
name: sdlc-lambda-cold-start
description: Use when a latency-sensitive Lambda has unacceptable p99 spikes from cold starts — covers measurement, the levers that actually move the number, and when provisioned concurrency is worth the cost.
---

## What a cold start is

When a Lambda has no warm container ready, AWS:

1. Downloads the deployment package
2. Initializes the runtime (Node.js / Python / etc.)
3. Runs module-scope code (`import`, client initialization, secret fetches)
4. Calls the handler

The first three steps are the cold start. Subsequent invocations on the same container skip them — that's a "warm" invocation.

Typical Node.js Lambda cold start: **100–500ms**, sometimes more if your package or init is heavy.

## Measure first

Don't guess. Look at the metrics:

- CloudWatch metric `InitDuration` (only present on cold-start invocations)
- X-Ray traces show the cold-start portion explicitly
- Datadog/Lumigo/Sentry observabilities surface it

If `InitDuration` is below your latency budget, ignore cold starts. Most cold-start panic is over a 200ms event in a path that's already 800ms — moving cold start to 100ms doesn't help users.

## Levers (in order of impact)

### 1. Use arm64 (graviton)

Switch architecture from x86_64 to arm64. ~10–20% faster cold start, ~20% cheaper. Free win unless you have arch-specific binaries.

### 2. Bundle and tree-shake

```bash
esbuild src/handler.ts --bundle --platform=node --target=node18 --outfile=dist/handler.js
```

Smaller deployment package = faster download. Tree-shaking removes unused code (entire SDK clients that you imported but didn't use).

For Node.js, the AWS SDK is heavy. Import only what you need:

```ts
// ❌ Pulls in the whole v3 root
import { S3 } from "@aws-sdk/client-s3";

// ✅ Tree-shakable client + command
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
```

### 3. Lazy-init heavy clients

Initialize only what the current invocation needs:

```ts
// ❌ All clients initialized at cold start
const db = new Client(...);
const stripe = new Stripe(...);
const sg = new SendGrid(...);

// ✅ Lazy
let db: Client | null = null;
function getDb() { return db ??= new Client(...); }
```

If a Lambda needs all three on every invocation, lazy doesn't help. If 90% of invocations don't need Stripe, lazy halves the init time.

### 4. Cache secrets at module scope

```ts
let cachedSecret: string | null = null;
async function getSecret() {
  if (cachedSecret) return cachedSecret;
  const res = await sm.send(new GetSecretValueCommand({ SecretId: "..." }));
  cachedSecret = res.SecretString!;
  return cachedSecret;
}
```

First invocation pays for the secret fetch; subsequent warm invocations skip. (See [[sdlc-secret-handling]].)

### 5. Provisioned concurrency (paid)

Pre-warm N containers. They stay hot indefinitely. No cold start for the first N concurrent requests.

```yaml
functions:
  checkoutApi:
    handler: src/checkout.handler
    provisionedConcurrency: 5
```

Costs money (you pay for the warmed containers idle). Worth it for:
- Critical user paths (checkout, login, signup)
- Spike-driven workloads (predictable traffic surges)

Not worth it for:
- Background workers (they batch; cold start doesn't matter)
- Low-traffic functions (rare cold starts are fine)

### 6. SnapStart (Java / Python only)

For Java/Python: AWS snapshots the initialized container; cold start is restoring the snapshot. Dramatic improvement (~5×). Not available for Node.js.

## Levers that don't actually help much

- Increasing memory (a small win; main effect is CPU, not init)
- Pinging the function on a schedule (CloudWatch EventBridge) — old hack, no longer reliably keeps containers warm at scale
- Removing imports you can't actually remove

## When to stop optimizing

Cold start optimization has diminishing returns. After:

- Arm64 ✓
- Bundle / tree-shake ✓
- Critical client lazy-init ✓
- Cache patterns in place ✓

You're at the floor of what Node.js gives you. Further gains need either provisioned concurrency or a different runtime (e.g. Bun, LLRT for AWS).

## Anti-patterns

- ❌ Optimizing cold start without measuring (it might not be the bottleneck)
- ❌ Provisioned concurrency on every function (cost balloons; most don't need it)
- ❌ Pinging endpoints to "keep warm" (unreliable, hacky)
- ❌ Eager-loading every client in module scope to "save time later" (cold start blown)
- ❌ Bundling the entire AWS SDK v2 (use v3 with tree-shaking)
- ❌ Hidden synchronous I/O in module scope (file reads, network calls)

## Gate criteria

- p99 cold-start time measured for every latency-sensitive function
- arm64 architecture used unless x86 specifically needed
- Bundled with esbuild (or equivalent) — no unnecessary deps in deployment package
- AWS SDK v3 with selective imports
- Heavy clients lazy-initialized where they're not always used
- Provisioned concurrency configured (and budgeted) for critical user paths only
- Cold-start metric on the dashboard
