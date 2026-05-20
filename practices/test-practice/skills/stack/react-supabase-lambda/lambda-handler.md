---
id: lambda-handler
title: "Lambda handler — JWT → validate → withRls → return"
layer: stack
stack: react-supabase-lambda
tags: [aws, lambda, jwt, auth, zod, rls, handler]
applies_to:
  task_types: [add-endpoint, add-handler, modify-handler]
  stages: [3, 5, 7]
size_tokens: 240
related: [api-endpoint-design, input-validation, supabase-rls, structured-logging]
---

# lambda-handler — Lambda Handler Pattern

## Pattern Summary

Every Lambda handler follows this exact five-step structure. Do not deviate.

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { verifyToken, extractBranchId } from "../../shared/auth";
import { withRls } from "../../shared/db";

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // 1. Verify JWT — always first, never skipped
  const claims = verifyToken(event.headers.Authorization ?? "");
  if (!claims) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  // 2. Extract branch_id from claims — never from request body
  const branchId = extractBranchId(claims);

  // 3. Parse and validate body with Zod — safeParse, never parse
  const parsed = RequestSchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) return { statusCode: 400, body: JSON.stringify({ error: parsed.error.flatten() }) };

  // 4. All DB work inside withRls — never a bare pool/client
  const result = await withRls(branchId, async (db) => {
    return db.query("SELECT ...", []);  // parameterized only
  });

  // 5. Return — never log customer data in the response body
  return { statusCode: 200, body: JSON.stringify({ data: result }) };
};
```

**Rules (must hold on every handler):**
- `verifyToken` before any other logic — 401 on failure
- `branchId` from JWT claims only — never from `event.body` or query params
- All DB calls inside `withRls` — never a bare client
- `safeParse` on all input — never `parse`
- No PII in logs — no email, phone, order contents, tokens

## Full Reference

### Shared auth/db shapes
```typescript
// src/shared/auth.ts
export function verifyToken(authHeader: string): JwtClaims | null
export function extractBranchId(claims: JwtClaims): string

// src/shared/db.ts
export async function withRls<T>(branchId: string, fn: (db: Pool) => Promise<T>): Promise<T>
```

### Forbidden
- `const branchId = event.body.branchId` — never from body
- Bare `pool.query(...)` outside `withRls`
- CORS headers in handler code — set at API Gateway
