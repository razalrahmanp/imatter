---
name: sdlc-code-review-checklist
description: Use when reviewing a pull request (own or others) — covers correctness, design, security, and the non-obvious things that take experience to spot.
---

## Rule

A code review checks four things in this order: does it do what it claims, is the design sound, is it safe in production, will future developers be able to maintain it. Style and nits come last and should be largely automated away.

## The checklist — work through it once per review

### 1. Correctness — does it do what the PR description claims?

- [ ] The diff matches the stated scope (no unrelated changes; see [[sdlc-surgical-changes]])
- [ ] Edge cases are handled: empty inputs, max inputs, null/undefined, error paths
- [ ] Tests exist and actually test the claim (run them mentally — do the assertions catch the bug if the code is wrong?)
- [ ] Integration with surrounding code is correct (the function works in isolation but called wrong)
- [ ] Returns the documented type/shape; doesn't silently change the contract

### 2. Design — will the codebase be better after this lands?

- [ ] Names are accurate (function does what its name says; variable doesn't lie)
- [ ] Single responsibility — function does one thing
- [ ] No premature abstraction (see [[sdlc-simplicity-first]] — three-times rule)
- [ ] No premature optimization (no caches, no early-return micro-tweaks without a benchmark)
- [ ] Matches existing style and conventions (see [[sdlc-match-existing-style]])
- [ ] File size in check (see [[sdlc-file-size-discipline]] — 300 line cap)

### 3. Safety — is this production-safe?

- [ ] No new secrets in code or logs (see [[sdlc-secret-handling]])
- [ ] No new PII in logs (see [[sdlc-pii-handling]])
- [ ] Input from external sources is validated (see [[sdlc-input-validation]])
- [ ] Authentication and authorization enforced where needed (see [[sdlc-authn-pattern]], [[sdlc-authz-pattern]])
- [ ] Errors caught and handled, not swallowed (see [[sdlc-error-handling]])
- [ ] External calls have timeout + retry (see [[sdlc-retry-with-backoff]])
- [ ] DB migration is backward-compatible (can roll back without data loss)
- [ ] No N+1 query introduced
- [ ] No race condition (two requests hitting this code simultaneously — what happens?)

### 4. Maintainability — can someone else change this in 6 months?

- [ ] Public API is documented (just enough — no PhD theses)
- [ ] Non-obvious WHY-comments where reasoning isn't visible from code
- [ ] No "magic" — constants are named, behavior is explicit
- [ ] Tests describe behavior in their names (see [[sdlc-unit-test-pattern]])
- [ ] No "TODO: refactor later" without an issue link
- [ ] Dependencies justified (a new dependency requires explicit reasoning)

### 5. The non-obvious things — experience-driven

- [ ] Concurrency: what if two requests hit this at the same time?
- [ ] Failure: what if the DB is down? The third-party API? The cache?
- [ ] Scale: does this scale to 10× current traffic? 100× current data?
- [ ] Migration: how does this deploy without breaking existing users?
- [ ] Rollback: can we roll this back in 5 minutes if it goes wrong?
- [ ] Observability: if this breaks in prod, will we know? Can we debug it?

## How to comment

| Severity | Format | When |
|---|---|---|
| **Blocker** | `Must fix:` | Breaks functionality, security risk, data corruption |
| **Concern** | `Consider:` or `Question:` | Design issue, not a defect |
| **Style** | `Nit:` | Personal taste, project conventions |
| **Praise** | `Nice:` | Specific good choices — say so |

Be specific. "This is wrong" without why is hostile and useless. "This will deadlock if A holds X while B waits for X" is helpful even if curt.

## Review etiquette

- Review your own PR first before requesting reviewers (catches half the issues)
- Reply to all reviewer comments, even with just an emoji or "fixed in <commit>"
- Don't dismiss-resolve comments unless the discussion is concluded
- Reviewer leaves merge call to the author unless requested otherwise (`r+` style)
- Author re-requests review after pushing fixes

## What automation should do — not the reviewer

- Linting (eslint, ruff, gofmt, etc.)
- Formatting (prettier, black)
- Type checking (tsc, mypy)
- Test running
- Coverage report
- Bundle size diff
- Security scanner (gitleaks, dependabot)
- Spell-check on docs

A reviewer should never be the bottleneck for these. If the CI doesn't catch it, the CI is missing a check.

## Anti-patterns

- ❌ Approving without reading (the PR has been open too long)
- ❌ LGTM-bombing — short non-substantive approvals on every PR
- ❌ Nitpicking style when an automated formatter exists
- ❌ Suggesting a full rewrite in a comment ("you should restructure this entire module")
- ❌ Letting personal preferences override project conventions
- ❌ Blocking on personal taste disagreements (escalate or yield)
- ❌ Re-reviewing the whole PR after a small fix (focus on the changes)

## Gate criteria

- A documented review checklist exists (or this skill is referenced)
- Style/format/lint/types/tests run in CI and block merge on failure
- PRs require at least one explicit approval before merge
- Critical paths (auth, billing, migrations) require two approvals or a CODEOWNERS-defined reviewer
- A median PR is reviewed and merged within team's SLA
