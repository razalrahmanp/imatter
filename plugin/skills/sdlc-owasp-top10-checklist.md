---
name: sdlc-owasp-top10-checklist
description: Use as the Stage 8 security gate audit — walks every OWASP Top 10 (2021) category against the current codebase, with grep recipes and what to check.
---

## Rule

Before passing the Stage 8 (Security) gate, walk every OWASP Top 10 category. Each item below has a *specific* thing to check — not a vibe, an actual grep or file inspection.

## A01 — Broken Access Control

| Check | How |
|---|---|
| Every route that touches user data calls `authorize()` before the business logic | grep handlers; manual review |
| Tenant ID is derived from the verified token, not request body | grep for `req.body.tenant_id`, `req.params.tenant_id` |
| Multi-tenant DB tables have RLS enabled | See [[sdlc-tenant-isolation]] |
| Admin-only routes are explicitly guarded, not just "hidden" in the UI | grep for admin routes, verify backend check |

## A02 — Cryptographic Failures

| Check | How |
|---|---|
| Passwords hashed with argon2/bcrypt/scrypt — not SHA-256, MD5, plain salt | grep for `crypto.createHash`, `md5`, `sha1` in auth code |
| Sensitive fields (PII, payment) encrypted at rest | Check DB column types + KMS config |
| TLS enforced; no `http://` URLs in production config | grep config files |
| No homegrown encryption (`xor`, custom ciphers) | grep for `XOR`, manual key handling |
| HSTS header set | Check response headers |

## A03 — Injection

| Check | How |
|---|---|
| SQL: every query uses parameterized statements; no string concatenation | grep for `` ` ` `` template strings in DB call sites |
| NoSQL: query objects do not include user input as keys/operators | grep for `req.body` inside Mongo/Redis call args |
| Command exec: no `exec`, `spawn`, `execSync` with user input | grep for `child_process` usage |
| LDAP/XML/XPath if applicable: parameterized | Audit those call sites |
| HTML rendering: escape by default; `dangerouslySetInnerHTML` justified | grep for that prop |

## A04 — Insecure Design

| Check | How |
|---|---|
| Rate limits on auth, password reset, payment, public APIs | See [[sdlc-rate-limiting]] |
| Account lockout on repeated failures | Auth code review |
| Sensitive operations require re-auth (changing email, password, payment method) | Flow review |
| No security through obscurity — features documented assume threats exist | Threat model exists in docs/ |

## A05 — Security Misconfiguration

| Check | How |
|---|---|
| Default credentials removed (admin/admin, etc.) | DB review, env review |
| Stack traces and error details not exposed to users | Check error handler middleware |
| Unnecessary services/ports closed | Infra config review |
| Security headers set: CSP, X-Frame-Options, X-Content-Type-Options | Hit prod, inspect headers |
| Cloud storage buckets not publicly listable | S3/GCS bucket policy audit |

## A06 — Vulnerable Components

| Check | How |
|---|---|
| Dependency scanner in CI (Dependabot, Renovate, Snyk) | `.github/dependabot.yml` exists, runs |
| No critical/high CVEs unaddressed for >30 days | Check current scanner output |
| Lockfile committed (`package-lock.json`, `poetry.lock`, etc.) | `ls` in repo root |
| Transitive deps audited (not just direct) | `npm audit --omit=dev` |

## A07 — Identification & Authentication Failures

See [[sdlc-authn-pattern]] for the detailed checklist.

| Check | How |
|---|---|
| MFA available for sensitive accounts | Auth provider config |
| Session tokens rotated on privilege change | Auth flow review |
| Password reset tokens single-use, short-lived | Reset flow review |
| No "remember me" implemented as long-lived JWT | grep token expiry settings |

## A08 — Software & Data Integrity Failures

| Check | How |
|---|---|
| CI builds use pinned action versions (`@sha256:...` not `@v1`) | `.github/workflows/*.yml` review |
| Update mechanism verifies signatures (Sigstore, code signing) | Deploy script review |
| Webhook payloads verified (HMAC, signature) before processing | Webhook handler review |
| Build artifacts attested (SLSA, provenance) — for higher-maturity orgs | CI config review |

## A09 — Logging & Monitoring Failures

See [[sdlc-structured-logging]].

| Check | How |
|---|---|
| Authentication failures logged (with masked email + IP) | Auth log review |
| Sensitive operations logged (role change, password reset, admin actions) | Audit log review |
| Logs centralized and tamper-resistant | Logging infra config |
| Alerts exist for: failed login spikes, admin actions out of hours, error rate spikes | Monitoring config |

## A10 — Server-Side Request Forgery (SSRF)

| Check | How |
|---|---|
| HTTP client wrapper rejects internal IPs (10.x, 172.16-31.x, 192.168.x, 169.254.x, ::1, fd00::/8) | grep HTTP client setup |
| URL inputs validated against an allowlist of domains | grep URL-accepting endpoints |
| Cloud metadata endpoint (169.254.169.254) explicitly blocked | HTTP client config |
| Image / file fetchers respect SSRF protections | Image handler review |

## Gate criteria

- Every category above has a verified check (citation or "N/A because…")
- No critical / high findings remain open
- Findings logged in Section 16 (Open Items) with severity + owner + deadline
- A scheduled re-audit is on the calendar (annually minimum, or after major arch change)
