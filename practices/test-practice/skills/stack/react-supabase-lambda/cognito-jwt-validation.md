---
id: cognito-jwt-validation
title: "Cognito JWT validation — JWKS fetch, token verify, claims extraction"
layer: stack
stack: react-supabase-lambda
tags: [cognito, jwt, auth, jwks, token-validation, aws]
applies_to:
  task_types: [add-handler, modify-handler, add-endpoint]
  stages: [3, 5, 6]
size_tokens: 210
related: [lambda-handler, supabase-rls, rabos-tenant-context]
---

# cognito-jwt-validation — Cognito JWT Validation Pattern

## Pattern Summary

Validate every JWT against the Cognito JWKS endpoint. Cache the JWKS — it rarely changes. Never trust the token body without signature verification.

**Validation implementation:**
```typescript
import { createPublicKey } from "crypto";
import { verify, decode } from "jsonwebtoken";

const JWKS_URL = `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

// Cache JWKS at module level — refreshed on cold start only
let jwksCache: { keys: JwkKey[] } | null = null;

async function getJwks(): Promise<{ keys: JwkKey[] }> {
  if (jwksCache) return jwksCache;
  const res = await fetch(JWKS_URL);
  jwksCache = await res.json();
  return jwksCache!;
}

export async function verifyToken(authHeader: string): Promise<RabosClaims | null> {
  const token = authHeader.replace(/^Bearer /, "");
  if (!token) return null;

  try {
    // Decode header to get key ID (kid)
    const header = decode(token, { complete: true })?.header;
    if (!header?.kid) return null;

    // Find matching JWK
    const { keys } = await getJwks();
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    // Verify signature and claims
    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const claims = verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: `https://cognito-idp.${process.env.AWS_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
      audience: process.env.COGNITO_CLIENT_ID,
    }) as RabosClaims;

    return claims;
  } catch {
    return null;   // expired, tampered, wrong issuer — all map to null → 401
  }
}
```

## Full Reference

### JWKS cache refresh
Cognito rotates signing keys periodically. If `verifyToken` returns null for a valid-looking token: clear `jwksCache = null` and retry once. Do not retry in a loop — avoids amplification attacks.

### Claims to extract
```typescript
export const extractBranchId = (c: RabosClaims) => c["custom:branch_id"];
export const extractRole     = (c: RabosClaims) => c["custom:role"];
export const extractTenantId = (c: RabosClaims) => c["custom:tenant_id"];
```
Never log `c.email` or `c.sub` — see rabos-tenant-context forbidden list.

### Forbidden
- Trusting `event.headers["x-branch-id"]` or request body for tenant resolution
- Skipping `issuer` or `audience` in `verify` options (allows tokens from other pools)
- Fetching JWKS on every request (DoS risk + unnecessary latency)
