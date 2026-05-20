---
id: lambda-cold-start
title: "Lambda cold start mitigation — provisioned concurrency, init code placement"
layer: stack
stack: react-supabase-lambda
tags: [lambda, cold-start, performance, provisioned-concurrency, aws]
applies_to:
  task_types: [add-handler, add-worker, deploy]
  stages: [5, 7]
size_tokens: 200
related: [lambda-handler, lambda-worker, serverless-yml-pattern]
---

# lambda-cold-start — Lambda Cold Start Mitigation

## Pattern Summary

Cold starts are unavoidable for infrequently-invoked Lambdas. Mitigate by: moving expensive init outside the handler, reducing bundle size, and using provisioned concurrency for latency-critical endpoints.

**Init code placement — run ONCE per container, not per invocation:**
```typescript
// ✓ CORRECT — module-level: runs during init, reused across invocations
import { Pool } from "pg";
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const SYSTEM_PROMPT = fs.readFileSync("./prompts/analyse.txt", "utf-8");

export const handler = async (event: APIGatewayProxyEvent) => {
  // db and SYSTEM_PROMPT are already initialised — no cold-start cost here
  const result = await db.query("SELECT ...");
};
```

```typescript
// ✗ WRONG — inside handler: re-initialised on every invocation
export const handler = async (event: APIGatewayProxyEvent) => {
  const db = new Pool(...);        // new pool every call — slow AND leaks connections
  const prompt = fs.readFileSync(...); // disk read every call
};
```

**Bundle size reduction (cold start correlates with bundle size):**
```bash
# Target: < 5 MB zipped for sub-100ms cold starts
# Use esbuild bundler with tree-shaking
esbuild src/functions/orders/handler.ts \
  --bundle --platform=node --target=node20 \
  --external:@aws-sdk/* \   # AWS SDK is pre-installed in Lambda runtime
  --minify --outfile=dist/handler.js
```

**Provisioned concurrency — for P99 latency SLA:**
```yaml
# serverless.yml
functions:
  orders-handler:
    provisionedConcurrency: 2   # keeps 2 instances warm — costs ~$15/month per unit
```
Use for: customer-facing endpoints with < 200ms P99 requirement. Do NOT use for background workers — waste of cost.

## Full Reference

### Cold start duration by runtime (approximate)
Node.js 20: 200–400ms cold, 1–5ms warm.
Python 3.12: 300–600ms cold.
Java 21 (GraalVM native): 50–100ms cold.

### DB connection pool size
Lambda: `max: 1` per pool (each Lambda instance is single-threaded). RDS Proxy handles pooling at the proxy layer — do not set `max > 3` or you exhaust RDS connections at scale.

### Forbidden
- Creating DB connections inside the handler function body
- Importing entire SDKs when only one sub-module is needed (e.g. `import AWS from 'aws-sdk'` vs `import { S3 } from '@aws-sdk/client-s3'`)
