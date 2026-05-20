---
name: sdlc-aws-cognito-multi-pool
description: Use when a backend must accept JWTs from more than one AWS Cognito User Pool (e.g. separate staff and customer pools, or staff and admin pools) — routes verification by issuer claim with per-pool JWKS caching.
---

## When to use

- The system has two or more Cognito User Pools (e.g. staff vs. customer, or admin vs. staff vs. end-user)
- A single Lambda or API endpoint must accept tokens from any of those pools
- You need role-based guards (`requireAdmin`, `requireStaff`) downstream

## The pattern

Route verification by reading the `iss` claim (without verifying first — decoding the header and payload is safe; just don't trust the signature yet). Each pool has its own JWKS endpoint, so a separate JWKS cache per pool is required.

```ts
import { CognitoJwtVerifier } from "aws-jwt-verify";

const STAFF_POOL_ISS = `https://cognito-idp.${REGION}.amazonaws.com/${STAFF_POOL_ID}`;
const ADMIN_POOL_ISS = `https://cognito-idp.${REGION}.amazonaws.com/${ADMIN_POOL_ID}`;

const staffVerifier = CognitoJwtVerifier.create({
  userPoolId: STAFF_POOL_ID,
  tokenUse: "access",
  clientId: STAFF_CLIENT_ID,
});

const adminVerifier = CognitoJwtVerifier.create({
  userPoolId: ADMIN_POOL_ID,
  tokenUse: "access",
  clientId: ADMIN_CLIENT_ID,
});

export type VerifiedClaims =
  | { pool: "staff"; sub: string; username: string }
  | { pool: "admin"; sub: string; username: string; roles: string[] };

export async function verifyAnyPool(token: string): Promise<VerifiedClaims> {
  const { payload } = decodeJwtUnsafe(token); // header + body decode, NO sig check

  if (payload.iss === STAFF_POOL_ISS) {
    const c = await staffVerifier.verify(token);
    return { pool: "staff", sub: c.sub, username: c.username };
  }
  if (payload.iss === ADMIN_POOL_ISS) {
    const c = await adminVerifier.verify(token);
    return { pool: "admin", sub: c.sub, username: c.username, roles: c["cognito:groups"] ?? [] };
  }
  throw new Error("unknown issuer");
}
```

## Guard helpers

```ts
export function requireStaff(c: VerifiedClaims): asserts c is Extract<VerifiedClaims, { pool: "staff" }> {
  if (c.pool !== "staff") throw new ForbiddenError("staff-only endpoint");
}

export function requireAdmin(c: VerifiedClaims): asserts c is Extract<VerifiedClaims, { pool: "admin" }> {
  if (c.pool !== "admin") throw new ForbiddenError("admin-only endpoint");
}
```

Use as:

```ts
export const handler = async (event) => {
  const claims = await verifyAnyPool(extractToken(event));
  requireAdmin(claims);              // throws if not admin
  return doAdminWork(claims.sub);    // TypeScript now knows claims.pool === "admin"
};
```

## Forbidden

- ❌ Logging `claims.sub`, `claims.email`, or `claims.username` — these are PII
- ❌ Sharing a single `JwksClient` between pools — each pool has a different JWKS URL
- ❌ Trusting the `iss` claim before verification (only use it for routing the verification, never for authorization)
- ❌ Skipping `tokenUse` check — an ID token has different claims than an access token; pick one per endpoint

## Gate criteria

- A `verifyAnyPool`-style function exists and is the only path that issues claims
- Each pool has its own JWKS-cached verifier instance
- `requireStaff` / `requireAdmin` guards are used on every endpoint that needs role gating
- No PII fields from claims appear in log statements (grep for `claims.email`, `claims.sub` in `console.*` / `logger.*` calls)
