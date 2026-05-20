---
id: rabos-tenant-context
title: "RABOS tenant context — JWT shape, tenant resolution, RLS injection"
layer: project
project: rabos
tags: [rabos, jwt, tenant, auth, rls, cognito]
applies_to:
  task_types: [add-handler, modify-handler, add-worker, add-endpoint]
  stages: [3, 6]
size_tokens: 220
related: [lambda-handler, supabase-rls, authn-pattern]
---

# rabos-tenant-context — Tenant Context Pattern

## Pattern Summary

Every authenticated request resolves to exactly one tenant (branch). The tenant context comes from the JWT, never from the request body.

**RABOS JWT claim shape (Cognito custom attributes):**
```typescript
interface RabosClaims {
  sub: string;                    // Cognito user ID
  "custom:branch_id": string;    // UUID of the branch
  "custom:role": "owner" | "staff" | "kitchen" | "admin";
  "custom:tenant_id": string;    // UUID of the tenant org (may own multiple branches)
  email: string;                 // do not log
  exp: number;
  iat: number;
}
```

**Tenant resolution in every Lambda handler:**
```typescript
import { verifyToken, extractBranchId, extractRole } from "../../shared/auth";

export const handler = async (event: APIGatewayProxyEvent) => {
  const claims = verifyToken(event.headers.Authorization ?? "");
  if (!claims) return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };

  const branchId = extractBranchId(claims);  // always from claims["custom:branch_id"]
  const role     = extractRole(claims);       // always from claims["custom:role"]

  // Role-based gate — check before any DB work
  if (role !== "owner" && event.httpMethod !== "GET") {
    return { statusCode: 403, body: JSON.stringify({ error: "Insufficient permissions" }) };
  }

  // All DB work scoped to branchId via withRls
  return withRls(branchId, async (db) => { /* ... */ });
};
```

**`branchId` is always from the JWT. Never trust `event.body.branchId` or query params.**

## Full Reference

### Role matrix
| Role | GET | POST/PUT | DELETE | Admin ops |
|------|-----|----------|--------|-----------|
| `owner` | ✓ | ✓ | ✓ | ✓ |
| `staff` | ✓ | ✓ (own orders) | ✗ | ✗ |
| `kitchen` | ✓ (order view only) | ✗ | ✗ | ✗ |
| `admin` | ✓ | ✓ | ✓ | ✓ |

### Forbidden
- Reading `branchId` from `event.body` or query string
- Skipping `verifyToken` for any route
- Logging `claims.email` or any PII from the JWT payload
- Cross-branch access — withRls enforces isolation at DB level
