# lambda-handler — Lambda Handler Pattern

## Pattern Summary

Every Lambda handler in this project follows this exact structure. Do not deviate.

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { verifyToken, extractBranchId } from "../../shared/auth";
import { withRls } from "../../shared/db";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // 1. Verify JWT — always first, never skipped
  const claims = verifyToken(event.headers.Authorization ?? "");
  if (!claims) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  // 2. Extract branch_id from claims — never from request body
  const branchId = extractBranchId(claims);

  // 3. Parse and validate body with Zod
  const parsed = MySchema.safeParse(JSON.parse(event.body ?? "{}"));
  if (!parsed.success) return { statusCode: 400, body: JSON.stringify({ error: parsed.error.flatten() }) };

  // 4. All DB work inside withRls — sets SET LOCAL app.branch_id before query
  const result = await withRls(branchId, async (db) => {
    return db.query("SELECT ...", []);  // parameterized only — never string interpolation
  });

  // 5. Return — never log customer data in the response body
  return { statusCode: 200, body: JSON.stringify(result) };
};
```

**Rules (must hold on every handler):**
- `verifyToken` called before any other logic — `statusCode: 401` on failure
- `branchId` from JWT claims only — never from `event.body` or query params
- All DB calls inside `withRls` — never a bare client
- Zod validation on all input — `safeParse`, not `parse`
- No PII in logs — no email, phone, order contents, session tokens

## Full Reference

### verifyToken shape
```typescript
// src/shared/auth.ts
export function verifyToken(authHeader: string): JwtClaims | null
export function extractBranchId(claims: JwtClaims): string
```

### withRls shape
```typescript
// src/shared/db.ts
export async function withRls<T>(branchId: string, fn: (db: Pool) => Promise<T>): Promise<T>
// Sets: SET LOCAL app.branch_id = $1 before fn runs
```

### Error response shape
```typescript
{ statusCode: 400 | 401 | 403 | 404 | 500, body: JSON.stringify({ error: string | object }) }
```
