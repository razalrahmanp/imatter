---
id: cognito-multi-pool
title: "Cognito multi-pool — staff pool + admin pool JWT routing"
layer: stack
stack: react-supabase-lambda
tags: [cognito, jwt, auth, multi-pool, aws, rbac]
applies_to:
  task_types: [add-handler, modify-handler, add-endpoint]
  stages: [3, 5, 6]
size_tokens: 240
related: [cognito-jwt-validation, lambda-handler, rabos-tenant-context, pii-handling]
---

# cognito-multi-pool — Cognito Multi-Pool Routing Pattern

## Pattern Summary

Tea Shop uses two Cognito User Pools: `STAFF_POOL` (branch staff and managers) and `ADMIN_POOL` (platform admins). Route to the correct pool by reading the `iss` claim from the decoded token header before full verification.

**Pool router (`src/shared/auth.ts`):**
```typescript
import { decode } from "jsonwebtoken";
import { verifyWithPool } from "./cognito-verify";

const STAFF_POOL_ID  = process.env.COGNITO_STAFF_POOL_ID!;
const ADMIN_POOL_ID  = process.env.COGNITO_ADMIN_POOL_ID!;
const STAFF_CLIENT   = process.env.COGNITO_STAFF_CLIENT_ID!;
const ADMIN_CLIENT   = process.env.COGNITO_ADMIN_CLIENT_ID!;
const REGION         = process.env.AWS_REGION!;

export type PoolType = "staff" | "admin";

export interface VerifiedClaims {
  pool:      PoolType;
  sub:       string;
  branch_id: string | undefined;  // undefined for admin pool tokens
  role:      string;
}

export async function verifyToken(authHeader: string): Promise<VerifiedClaims | null> {
  const token = authHeader.replace(/^Bearer /, "");
  if (!token) return null;

  const decoded = decode(token, { complete: true });
  const iss: string = decoded?.payload?.iss ?? "";

  if (iss.includes(STAFF_POOL_ID)) {
    return verifyWithPool(token, STAFF_POOL_ID, STAFF_CLIENT, REGION, "staff");
  }
  if (iss.includes(ADMIN_POOL_ID)) {
    return verifyWithPool(token, ADMIN_POOL_ID, ADMIN_CLIENT, REGION, "admin");
  }

  return null; // unknown issuer -> reject
}
```

**Pool-specific verifier (`src/shared/cognito-verify.ts`):**
```typescript
// One JWKS cache per pool — separate Maps, not a single shared cache
const jwksCache = new Map<string, { keys: JwkKey[] }>();

export async function verifyWithPool(
  token: string,
  poolId: string,
  clientId: string,
  region: string,
  pool: PoolType,
): Promise<VerifiedClaims | null> {
  try {
    const jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${poolId}/.well-known/jwks.json`;
    let jwks = jwksCache.get(poolId);
    if (!jwks) {
      jwks = await fetch(jwksUrl).then((r) => r.json());
      jwksCache.set(poolId, jwks!);
    }

    const header  = decode(token, { complete: true })?.header;
    const jwk     = jwks!.keys.find((k) => k.kid === header?.kid);
    if (!jwk) return null;

    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const claims    = verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer:     `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
      audience:   clientId,
    }) as Record<string, string>;

    return {
      pool,
      sub:       claims.sub,
      branch_id: claims["custom:branch_id"],
      role:      claims["custom:role"] ?? (pool === "admin" ? "platform-admin" : "staff"),
    };
  } catch {
    return null;
  }
}
```

**Guard helper for admin-only endpoints:**
```typescript
export function requireAdmin(claims: VerifiedClaims | null): claims is VerifiedClaims {
  return claims?.pool === "admin";
}

export function requireStaff(claims: VerifiedClaims | null): claims is VerifiedClaims {
  return claims?.pool === "staff" && !!claims.branch_id;
}
```

## Full Reference

### Environment variables required
| Variable | Value |
|---|---|
| `COGNITO_STAFF_POOL_ID` | `ap-south-1_xxxxxxxxx` (staff pool) |
| `COGNITO_ADMIN_POOL_ID` | `ap-south-1_yyyyyyyyy` (admin pool) |
| `COGNITO_STAFF_CLIENT_ID` | App client ID for staff pool |
| `COGNITO_ADMIN_CLIENT_ID` | App client ID for admin pool |

### Why route via `iss` and not two separate endpoints
A single `verifyToken` entry point keeps Lambda handler code clean — handlers call one function and get a pool-typed result. Two separate endpoints would require every handler to know which pool to use before auth, inverting the responsibility.

### JWKS cache invalidation
If `verifyWithPool` returns null for a seemingly valid token: `jwksCache.delete(poolId)` and retry once. Cognito rotates signing keys periodically. Never retry in a loop.

### Forbidden
- Trusting `custom:role` or `custom:branch_id` from the request body/headers — always from verified JWT
- Using a shared JWKS cache across both pools (different key sets, different `kid` namespaces)
- Calling `verify()` without specifying `issuer` and `audience` (cross-pool token acceptance risk)
- Logging `claims.sub` or `claims.email` (PII — log only `pool` and `role`)
