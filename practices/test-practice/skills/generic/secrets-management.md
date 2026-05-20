---
id: secrets-management
title: "Secrets management — never in code/env files, AWS Secrets Manager, rotation"
layer: generic
tags: [secrets, security, aws-secrets-manager, environment-variables, rotation]
applies_to:
  task_types: [add-handler, add-integration, deploy, any]
  stages: [2, 3, 5]
size_tokens: 195
related: [environment-config, structured-logging, serverless-yml-pattern]
---

# secrets-management — Secrets Management Pattern

## Pattern Summary

Secrets never appear in code, git history, or unencrypted config files. Use AWS Secrets Manager for all production secrets. Fetch at Lambda startup, not on every request.

**Secret tiers:**
```
Tier 1 — Config (non-secret): API endpoints, feature flags, region, timeout values
  → Store in SSM Parameter Store (cheaper, no rotation needed)
  → Reference in serverless.yml environment block

Tier 2 — Secrets: DB passwords, API keys, private keys, webhook secrets
  → Store in AWS Secrets Manager
  → Fetch in Lambda init code (module-level, not in handler)
  → Never log, never return in API responses
```

**Fetching secrets at Lambda startup:**
```typescript
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secretsmanager";

const sm = new SecretsManagerClient({});

// Module-level — fetched once per container lifecycle
let secrets: { databaseUrl: string; razorpaySecret: string } | null = null;

async function getSecrets() {
  if (secrets) return secrets;
  const { SecretString } = await sm.send(new GetSecretValueCommand({
    SecretId: `/rabos/${process.env.STAGE}/app-secrets`,
  }));
  secrets = JSON.parse(SecretString!);
  return secrets!;
}

export const handler = async (event: APIGatewayProxyEvent) => {
  const { databaseUrl } = await getSecrets();
  // ...
};
```

**Rotation:**
Enable automatic rotation in Secrets Manager for DB credentials. Lambda fetches the current version — rotation is transparent to the application.

## Full Reference

### What counts as a secret
Database passwords, API private keys, JWT signing secrets, encryption keys, service account credentials, OAuth client secrets, webhook verification secrets.

### What is NOT a secret
Database host/port/name (put in SSM or environment variable), AWS region, S3 bucket name, Cognito pool ID (public information — safe as environment variable).

### Forbidden
- Secrets in `.env` files committed to git (even `.env.local` if gitignore isn't perfect)
- Hardcoded credentials anywhere in source
- Logging secret values (even partial — mask with `***`)
- `console.log(process.env)` which dumps all environment variables
