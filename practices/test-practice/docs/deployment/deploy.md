# Tea Shop Project — Deployment & Release

Version: 1.0 | Date: 2026-05-19

---

## Environments

| Environment | Trigger | URL |
|---|---|---|
| `dev` | Local — `npm run dev` | localhost |
| `staging` | Auto on merge to `main` | `STAGING_API_URL` (GitHub Secret) |
| `prod` | Manual approval after staging passes | `PROD_API_URL` (GitHub Secret) |

---

## Deployment Platform

| Layer | Service | Deploy method |
|---|---|---|
| Frontend | AWS Amplify | Auto-deploy from `main` via Amplify console connection |
| Backend (Lambda) | AWS Lambda | AWS CDK / SAM via CI pipeline |
| Database | Amazon RDS PostgreSQL (Multi-AZ) | Migrations run by CI before Lambda deploy |
| Real-time | API Gateway WebSockets | Deployed with Lambda via CDK/SAM |
| Feature flags | AWS AppConfig | Manual via AWS console or CLI |

---

## Rollback Strategy — Lambda Versioning + Aliases

Every deploy publishes a new Lambda version. The `live` alias always points to the current production version.

```
Lambda versions:
  v1  ← previous (kept)
  v2  ← current ("live" alias points here)

Rollback (takes ~10 seconds):
  aws lambda update-alias \
    --function-name tea-shop-orders \
    --name live \
    --function-version 1
```

**Rule:** Every DB migration must be backward-compatible. The v1 Lambda must still work against the v2 schema during the alias swap window.

**Rollback runbook:**
1. Identify the broken function from CloudWatch alarms
2. Find the previous version number in the Lambda console
3. Run the alias update command above for each affected function
4. Verify smoke test passes
5. Open a `fix/` branch — do not leave the alias on an old version permanently

---

## Deploy Traffic Strategy — Canary

New Lambda versions receive 10% of traffic first. If error rate stays below threshold for 5 minutes, CodeDeploy shifts 100% of traffic to the new version automatically.

```
Deploy v3:
  0 min  → 10% traffic to v3, 90% to v2
  5 min  → error rate OK → 100% traffic to v3
  5 min  → error spike  → automatic rollback to v2
```

Configure in CDK/SAM deployment config:
```yaml
DeploymentPreference:
  Type: Canary10Percent5Minutes
  Alarms:
    - !Ref ErrorRateAlarm   # defined in Stage 7
```

---

## Feature Flags — AWS AppConfig

Feature flags are managed in AWS AppConfig under application `tea-shop`.

**Current flags:**

| Flag | Default | Purpose |
|---|---|---|
| `new_payment_flow` | `false` | Toggle new Razorpay payment UI |
| `fcm_alerts_enabled` | `true` | Enable/disable FCM push notifications |
| `maintenance_mode` | `false` | Show maintenance page to all customers |

**How to toggle a flag:**
```bash
# Via AWS CLI
aws appconfig start-deployment \
  --application-id <app-id> \
  --environment-id <env-id> \
  --configuration-profile-id <profile-id> \
  --configuration-version <version>
```
Or toggle directly in the AWS AppConfig console — no redeploy required.

**How Lambda reads flags:**
```typescript
// src/shared/flags.ts
import { AppConfigDataClient, GetLatestConfigurationCommand } from "@aws-sdk/client-appconfigdata";

export async function getFlag(flagName: string): Promise<boolean> {
  // cached at Lambda warm start — re-fetched every 30s
}
```

---

## Required GitHub Secrets

Set these in GitHub → Settings → Secrets → Actions before first deploy:

| Secret | Used in |
|---|---|
| `AWS_ACCESS_KEY_ID_STAGING` | staging deploy |
| `AWS_SECRET_ACCESS_KEY_STAGING` | staging deploy |
| `AWS_ACCESS_KEY_ID_PROD` | prod deploy |
| `AWS_SECRET_ACCESS_KEY_PROD` | prod deploy |
| `AWS_REGION` | both |
| `STAGING_DATABASE_URL` | staging migrations |
| `STAGING_API_URL` | staging smoke test |
| `PROD_DATABASE_URL` | prod migrations |
| `PROD_API_URL` | prod smoke test |

---

## First Deploy Checklist

Before the first staging deploy:

- [ ] RDS instance created in staging (Multi-AZ off for staging, on for prod)
- [ ] Cognito user pools created (staff + admin) in staging
- [ ] AWS AppConfig application and environment created
- [ ] GitHub Secrets populated
- [ ] `production` GitHub environment created with required reviewers set
- [ ] Lambda alias `live` created for each function
- [ ] CodeDeploy application created with canary deployment config
