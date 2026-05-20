---
name: sdlc-cognito-jwt-validation
description: Use when validating AWS Cognito-issued JWTs in backend code (Lambda, API server) — covers JWKS caching, token-use checks, and the validation rules that differ from generic JWT verification.
---

## Rule

A Cognito JWT must be verified against the pool's JWKS, with the correct `token_use`, the right `client_id`, and the correct issuer. Use a library that does this for you (aws-jwt-verify); don't hand-roll. Cache the JWKS — fetching on every request kills latency and Cognito has rate limits.

## Pattern — `aws-jwt-verify` (recommended)

```ts
import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: "access",           // "id" for ID tokens; "access" for API auth
  clientId: process.env.COGNITO_CLIENT_ID!,
});

// On every request:
export async function verifyToken(token: string) {
  try {
    return await verifier.verify(token);
  } catch (err) {
    throw new Error("invalid_token");
  }
}
```

The library:
- Fetches and caches the JWKS automatically
- Validates signature with the right key (by `kid`)
- Verifies issuer, audience, token_use, client_id
- Checks expiration

## ID token vs access token

| Type | Contains | Use for |
|---|---|---|
| **ID token** | User attributes (sub, email, custom claims) | Identifying the user in your backend |
| **Access token** | Scopes; less PII | API authorization; the standard bearer token |

Pick one per endpoint. Set `tokenUse` accordingly. Don't accept both for the same endpoint — you'll mix up what's available in the claims.

## Multi-pool — see the related skill

If your backend accepts tokens from more than one Cognito pool, see [[sdlc-aws-cognito-multi-pool]] — the pattern routes verification by `iss` claim and keeps a separate verifier per pool.

## Manual validation (only if not using aws-jwt-verify)

```ts
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`;

async function verifyToken(token: string) {
  const decoded = decodeJwtUnsafe(token);

  // 1. Match key from JWKS
  const jwks = await getCachedJwks();
  const key = jwks.keys.find(k => k.kid === decoded.header.kid);
  if (!key) throw new Error("unknown kid");

  // 2. Verify signature
  const verified = await jwtVerify(token, jwkToPem(key));

  // 3. Check claims
  if (verified.iss !== ISSUER) throw new Error("wrong issuer");
  if (verified.token_use !== "access") throw new Error("wrong token_use");
  if (verified.client_id !== CLIENT_ID) throw new Error("wrong client_id");
  if (verified.exp * 1000 < Date.now()) throw new Error("expired");

  return verified;
}
```

This is a sketch; production manual implementation has more pitfalls. Use `aws-jwt-verify`.

## JWKS caching

Cognito's JWKS endpoint has rate limits and adds latency. Cache for at least 60 minutes; aws-jwt-verify does this automatically. If you hand-roll, cache the JWKS in module scope (Lambda) or in Redis.

## Token sources — extract from the request

```ts
function extractToken(event: APIGatewayProxyEvent): string {
  const auth = event.headers?.["Authorization"] ?? event.headers?.["authorization"];
  if (!auth?.startsWith("Bearer ")) throw new Error("missing bearer token");
  return auth.slice(7);
}
```

Don't accept tokens in query strings or cookies for API endpoints — Bearer header only.

## Claim PII — don't log

```ts
// ❌ Wrong — sub and email are PII
logger.info("authenticated", { claims });

// ✅ Right — log nothing PII
logger.info("authenticated");
```

See [[sdlc-pii-handling]] for what counts as PII. The `sub` is an internal identifier — still don't log it routinely.

## Anti-patterns

- ❌ Hand-rolling JWT verification when a library exists
- ❌ Verifying signature only; skipping issuer, client_id, token_use, expiration
- ❌ Accepting both ID and access tokens for the same endpoint
- ❌ JWKS fetched on every request (rate-limited, slow)
- ❌ Caching the JWKS without refresh (key rotation breaks you)
- ❌ Logging the full claims (PII leak)
- ❌ Trusting `email_verified=false` claims (don't authorize unverified users)
- ❌ Using `auth.users` table directly (Supabase) instead of verifying the JWT in app code

## Gate criteria

- Token verification uses `aws-jwt-verify` (or another battle-tested library)
- `tokenUse` and `clientId` are explicitly checked (not just signature)
- JWKS is cached with a sane TTL
- Tokens come from `Authorization: Bearer` header only — not query string, not cookie
- Claims are never logged (PII)
- A test exists that submits an expired, tampered, and wrong-pool token — all should be rejected
