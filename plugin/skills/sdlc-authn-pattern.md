---
name: sdlc-authn-pattern
description: Use when implementing user authentication (sign-up, sign-in, session management, token issuance) — required reading before touching any auth-adjacent code path.
---

## Rule

Authentication is "who are you?" — distinct from authorization ("what can you do?"). Get the boundary right: every authenticated route reads a verified token, never a client-supplied user ID.

## Pattern

| Step | What |
|---|---|
| 1 | User sends credential (password, OAuth code, magic link) |
| 2 | Server verifies credential against the source of truth |
| 3 | Server issues a session (cookie, JWT) with a short lifetime |
| 4 | Every subsequent request includes the session |
| 5 | Server verifies the session on every request |

Step 5 is the one that gets skipped. Don't skip it.

## Password authentication (when not using a provider)

```ts
// Hash with a slow KDF — bcrypt, argon2, scrypt. Never SHA-256.
import argon2 from "argon2";

const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,    // 19 MB
  timeCost: 2,
  parallelism: 1,
});

// On login:
const ok = await argon2.verify(storedHash, submittedPassword);
```

| Setting | Value |
|---|---|
| Algorithm | argon2id (preferred), bcrypt (acceptable), scrypt (acceptable) |
| Minimum password length | 12 characters |
| Maximum password length | 128 (DoS protection — argon2 is slow) |
| Rate limit on login | 5/minute/IP, 10/minute/account (whichever lower) |
| Lockout | After 10 failed attempts → require email confirmation |
| Password reset | Single-use token, 15-minute expiry, invalidates all sessions |

## Sessions — pick one

**Server-side sessions (recommended for browser apps)**
- Session ID is a random 256-bit value stored in HttpOnly + Secure + SameSite cookie
- Server keeps session → user ID mapping in Redis/DB
- Logout deletes the row → token invalidation is instant

**JWTs (for APIs and mobile)**
- Signed (RS256 or ES256), short lifetime (≤15 min)
- Refresh token is server-side, can be revoked
- Never JWE for session — encrypted JWTs add no real benefit and hide bugs

## Multi-pool / multi-provider

If you accept tokens from more than one provider (e.g. customer pool + admin pool), route verification by issuer claim. See `sdlc-aws-cognito-multi-pool` for the pattern.

## Anti-patterns

- ❌ Trusting `X-User-Id` header on backend — anyone can send any header
- ❌ Using `localStorage` for the session token in browser — XSS = full account takeover
- ❌ "Remember me" implemented as a 1-year JWT (refresh token rotation is the right answer)
- ❌ Storing passwords hashed with SHA-256 / MD5 / unsalted bcrypt cost
- ❌ Verifying password equality with `==` (timing attack — use `crypto.timingSafeEqual` after KDF)
- ❌ Returning different error messages for "user not found" vs "wrong password" (enumeration)
- ❌ Sending session tokens in URL query strings (logged everywhere)

## Gate criteria

- Password hashing uses argon2/bcrypt/scrypt with cost ≥ industry minimum
- All authenticated routes derive user ID from a verified token, never from request body/headers/query
- Login endpoint is rate-limited (per IP and per account)
- Session cookies have HttpOnly, Secure, SameSite=Lax (or Strict)
- Password reset tokens are single-use and short-lived
- Login error messages do not reveal whether an account exists
