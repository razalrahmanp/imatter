---
name: sdlc-secret-handling
description: Use when adding, rotating, or auditing any credential (API key, database password, signing key, OAuth client secret, encryption key) — covers storage, retrieval, rotation, and the patterns that leak secrets.
---

## Rule

Secrets are never hardcoded, never committed, never logged, never sent to LLMs, and never put in plaintext environment variables in shared deployment configs. Fetch from a secret store at runtime, cache in memory only.

## Storage — pick one tier and stick to it

| Tier | Use for | Notes |
|---|---|---|
| AWS Secrets Manager / GCP Secret Manager / Azure Key Vault | Production secrets in cloud | Auto-rotation supported for some types |
| HashiCorp Vault | Multi-cloud or on-prem | Heavier; needs operational team |
| Doppler / Infisical | Small teams, all environments | Good DX, paid above a tier |
| `.env` + `.env.example` | Local dev only | `.env` is gitignored; `.env.example` is committed |
| Hardcoded | Never | — |

## Pattern — fetch + cache

```ts
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const cache = new Map<string, { value: any; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000;

export async function getSecret<T>(secretId: string): Promise<T> {
  const cached = cache.get(secretId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const client = new SecretsManagerClient({});
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = JSON.parse(res.SecretString!);

  cache.set(secretId, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}
```

In-memory cache TTL is intentional — short enough that rotation takes effect quickly, long enough to avoid hammering the secret store.

## Rotation

| Secret type | Rotation cadence | How |
|---|---|---|
| API keys (third-party) | 90 days or on suspicion | Provider's rotation flow; update in store |
| DB passwords | 90 days | Cloud provider's automatic rotation (Secrets Manager) |
| Signing/encryption keys | 1 year or per compliance | Dual-key window: accept old + new during cutover |
| OAuth client secrets | 90 days | Provider's flow |
| Webhook signing secrets | On suspicion or 1 year | Coordinate with sender |

After rotation, the in-memory cache TTL means existing containers will pick up the new value within `TTL_MS`.

## Anti-patterns

- ❌ `const API_KEY = "sk-live-..."` — hardcoded
- ❌ `process.env.STRIPE_SECRET` in a `next.config.js` that gets bundled to client
- ❌ Logging the secret value when it fails to parse
- ❌ Including secrets in error messages sent to users
- ❌ Putting secrets in URL paths or query strings (logged by every proxy)
- ❌ Sending secrets to an LLM as "context" (they go to the LLM provider and may be logged)
- ❌ Committing `.env` (always gitignore; verify with `git ls-files | grep .env`)
- ❌ Sharing secrets via Slack/email (use a secret-sharing tool with expiry)

## Detection in CI

Run a secret scanner (gitleaks, trufflehog, ggshield) in CI before merge. Even one leaked commit means the secret is compromised — rotate immediately even if the repo is private.

## Gate criteria

- No literal `sk-`, `pk-live`, `AKIA`, `AIza`, `xoxb-`, or other known-prefix tokens in the repo (CI scanner job exists)
- All secrets resolved at runtime from a secret store, not from plaintext env vars in shared configs
- `.env` is in `.gitignore` and absent from `git ls-files`
- Error reporters have a `beforeSend` filter stripping secret-shaped strings
- Secret rotation runbook exists in the runbook section
