---
id: serverless-yml-pattern
title: "serverless.yml pattern — function structure, env vars, IAM, deployment stages"
layer: stack
stack: react-supabase-lambda
tags: [serverless-framework, serverless-yml, lambda, iam, deployment, aws]
applies_to:
  task_types: [add-handler, add-worker, deploy]
  stages: [2, 5, 7]
size_tokens: 210
related: [lambda-handler, lambda-worker, lambda-cold-start, eventbridge-pattern]
---

# serverless-yml-pattern — serverless.yml Structure Pattern

## Pattern Summary

Define Lambdas declaratively in `serverless.yml`. Share config via the `provider` block. Scope IAM permissions to the minimum required per function using `iamRoleStatements` at the function level.

**Standard structure:**
```yaml
service: rabos-api
frameworkVersion: "3"

provider:
  name: aws
  runtime: nodejs20.x
  region: ${opt:region, 'ap-south-1'}
  stage: ${opt:stage, 'dev'}
  architecture: arm64    # Graviton2 — 20% cheaper, same or better perf for Node.js
  memorySize: 256        # default — override per function if needed
  timeout: 29            # API Gateway max is 29s
  environment:
    DATABASE_URL: ${ssm:/rabos/${sls:stage}/database_url}
    COGNITO_USER_POOL_ID: ${ssm:/rabos/${sls:stage}/cognito_pool_id}
    COGNITO_CLIENT_ID: ${ssm:/rabos/${sls:stage}/cognito_client_id}
    EVENT_BUS_NAME: rabos-events-${sls:stage}
    NODE_OPTIONS: "--enable-source-maps"
  iam:
    role:
      statements: []    # no global permissions — grant per function

functions:
  orders-handler:
    handler: dist/functions/orders/handler.handler
    description: "Orders CRUD — create, list, update status, cancel"
    memorySize: 512      # override when this function needs more memory
    events:
      - http:
          path: /orders
          method: ANY
          cors: true
          authorizer:
            type: COGNITO_USER_POOLS
            authorizerId: !Ref ApiGatewayAuthorizer
    iamRoleStatements:
      - Effect: Allow
        Action: [secretsmanager:GetSecretValue]
        Resource: arn:aws:secretsmanager:${aws:region}:${aws:accountId}:secret:/rabos/${sls:stage}/*
      - Effect: Allow
        Action: [events:PutEvents]
        Resource: !GetAtt RabosEventBus.Arn
```

## Full Reference

### SSM vs Secrets Manager
SSM Parameter Store: config values, ARNs, non-sensitive settings. SecretManager: database credentials, API keys, anything that rotates. Reference SSM directly in `serverless.yml`; fetch Secrets Manager at runtime in the handler.

### Stage-specific overrides
```yaml
custom:
  prod:
    memorySize: 1024
    provisionedConcurrency: 2
  dev:
    memorySize: 256
```

### Forbidden
- Hardcoding account IDs or region strings (use `${aws:accountId}`, `${aws:region}`)
- Wildcard IAM actions (`Action: "*"`) — always name specific actions
- Checking secrets from SSM inside the handler — pull from environment variables set in provider.environment
