---
id: environment-config
title: "Environment config — 12-factor, .env.example, stage-aware, no defaults for secrets"
layer: generic
tags: [configuration, environment-variables, 12-factor, dotenv, deployment]
applies_to:
  task_types: [add-handler, add-integration, deploy, any]
  stages: [2, 5, 7]
size_tokens: 190
related: [secrets-management, serverless-yml-pattern, structured-logging]
---

# environment-config — Environment Configuration Pattern

## Pattern Summary

Configuration comes from the environment, not hardcoded in code. Secrets come from Secrets Manager. Non-secrets can be environment variables. `.env.example` is the contract — always keep it current.

**Configuration hierarchy:**
```
1. Secrets Manager     — passwords, API keys (fetched at runtime)
2. SSM Parameter Store — ARNs, endpoints, pool IDs (injected at deploy time)
3. Environment vars    — stage, region, feature flags (set in serverless.yml)
4. .env.local          — local development only, never committed
```

**`.env.example` (committed to repo — all keys, no real values):**
```bash
# Application
STAGE=dev
AWS_REGION=ap-south-1
LOG_LEVEL=info

# Cognito (non-secret — public identifiers)
COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# EventBridge
EVENT_BUS_NAME=rabos-events-dev

# Secrets (fetched from Secrets Manager — do not put real values here)
# APP_SECRETS_ARN=arn:aws:secretsmanager:...
```

**Validation at startup (fail fast on misconfiguration):**
```typescript
const REQUIRED_ENV = [
  "STAGE", "AWS_REGION", "COGNITO_USER_POOL_ID",
  "COGNITO_CLIENT_ID", "EVENT_BUS_NAME"
] as const;

function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

// Call at module level — Lambda fails on cold start if misconfigured, not mid-request
validateEnv();
```

## Full Reference

### Stage-aware config in serverless.yml
```yaml
environment:
  STAGE: ${sls:stage}
  LOG_LEVEL: ${self:custom.logLevel.${sls:stage}, 'info'}
custom:
  logLevel:
    prod: warn
    staging: info
    dev: debug
```

### No defaults for critical config
Never write `process.env.DATABASE_URL ?? "postgresql://localhost"`. A missing prod secret should crash loudly at startup, not silently connect to localhost.

### Forbidden
- Committing `.env`, `.env.local`, or `.env.prod` to git
- Hardcoding stage names as strings inside application code (use `process.env.STAGE`)
- Different config shapes between environments — same keys, different values
