---
name: sdlc-serverless-yml-pattern
description: Use when writing or auditing Serverless Framework / SAM / Pulumi config — covers per-function tuning, IAM least-privilege, and the patterns that prevent config drift.
---

## Rule

Infrastructure config is code. Per-function settings (memory, timeout, concurrency) are tuned, not defaulted. IAM permissions are least-privilege, scoped per function. Use one tool consistently (don't mix Serverless Framework with hand-CloudFormation snippets unless documented why).

## Per-function tuning

```yaml
functions:
  checkoutApi:
    handler: src/checkout.handler
    memorySize: 1024              # CPU scales linearly with memory
    timeout: 15                    # seconds; matches API GW max useful
    reservedConcurrency: 100       # cap to protect downstream
    provisionedConcurrency: 5      # warm containers for low latency
    architecture: arm64            # cheaper, faster
    events:
      - httpApi:
          path: /checkout
          method: POST
    environment:
      STRIPE_SECRET_ARN: ${self:custom.stripeSecretArn}
    iamRoleStatements:
      - Effect: Allow
        Action: secretsmanager:GetSecretValue
        Resource: ${self:custom.stripeSecretArn}
```

Don't use the default `provider`-wide settings for everything — different functions have different needs.

## IAM — least privilege per function

```yaml
# ❌ Don't do this — every function gets dynamodb:* on every table
provider:
  iamRoleStatements:
    - Effect: Allow
      Action: dynamodb:*
      Resource: "*"

# ✅ Per-function permissions
functions:
  ordersApi:
    iamRoleStatements:
      - Effect: Allow
        Action: [dynamodb:GetItem, dynamodb:PutItem]
        Resource: !GetAtt OrdersTable.Arn
      - Effect: Allow
        Action: [dynamodb:Query]
        Resource: !Sub "${OrdersTable.Arn}/index/*"
```

Audit by reading the IAM policy and asking: "what's the minimum this function needs?"

## Environment variables

- Never put secrets in env vars in plaintext — use Secrets Manager ARN and fetch at runtime (see [[sdlc-secret-handling]])
- Different vars per stage (dev / staging / prod) via stage-specific files or AWS Parameter Store

```yaml
provider:
  environment:
    STAGE: ${self:custom.stage}
    LOG_LEVEL: ${self:custom.logLevel.${self:custom.stage}}
```

## Stage-specific config

```yaml
custom:
  stage: ${opt:stage, 'dev'}
  logLevel:
    dev: debug
    staging: info
    prod: warn
  ordersTableName: ${self:custom.stage}-orders
```

Avoid hardcoding `dev`/`staging`/`prod` in handler code. Pass through env.

## Resource naming

Include stage in every resource name:

```yaml
resources:
  Resources:
    OrdersTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:custom.ordersTableName}
```

Prevents dev resources getting accidentally hit by prod traffic (and vice versa).

## Plugins commonly used

| Plugin | Purpose |
|---|---|
| `serverless-esbuild` | Bundle TS with esbuild (faster than Webpack) |
| `serverless-iam-roles-per-function` | Required for per-function IAM (default is shared) |
| `serverless-prune-plugin` | Delete old Lambda versions; otherwise S3 fills up |
| `serverless-dotenv-plugin` | Load .env locally without committing |
| `serverless-step-functions` | Define Step Functions in YAML |

## Anti-patterns

- ❌ Default memory (1024MB) for every function — waste or starvation
- ❌ One IAM role shared across all functions (over-privileged)
- ❌ Secrets in `environment` block as plaintext
- ❌ Hardcoded resource names (no stage isolation)
- ❌ `timeout: 900` (15min max) for everything (real bugs hidden as slow execution)
- ❌ One enormous `serverless.yml` (split with includes / split files / different services)
- ❌ Hand-editing the deployed CloudFormation (drift from source)
- ❌ Different tools for different parts (some Pulumi, some Terraform, some hand-CF) — pick one
- ❌ No CI deploy (people deploy from laptops with their own creds)

## Gate criteria

- Per-function memory, timeout, concurrency are tuned and documented
- IAM permissions are per-function and least-privilege
- Secrets come from Secrets Manager, not env literal
- Stage included in every resource name
- Bundling configured (esbuild / Webpack) — no node_modules in deployment package
- CI deploys to all environments; local deploy is dev-only
- A `pnpm sls deploy --stage prod` (or equivalent) is the only way to ship
