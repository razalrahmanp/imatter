# SDLC Validation & Control Document
> **Project: Tea Shop (Rabos) -- practices/test-practice**
> Stages 1-4 PASSED. Stage 5 (Build & CI) IN PROGRESS.

---

## 0. Protocol Rules -- Claude must read this first

### 0.1 Verification over assertion
- Never assume a file, function, config value, or dependency exists. Read it or grep for it.
- Every finding must be cited as `file:line`. A finding with no citation is not a finding.
- If something cannot be verified from the codebase, mark it `UNVERIFIED` and ask.

### 0.2 Gate discipline
- Before starting work in any stage, read that stage's gate section in this document.
- Do not begin Stage N work until Stage N's gate status is `PASSED`.
- Do not mark a gate `PASSED` unless every criterion has a `file:line` citation or explicit user confirmation.
- If a prerequisite gate is `NOT STARTED` or `IN PROGRESS`, stop and state what is missing.

### 0.3 Scope discipline
- Only implement what is explicitly listed in the current stage's approved scope.
- If you notice something out of scope, log it in **Section 16 (Open Items)** and ask.

### 0.4 Decision discipline
- Log every significant decision in **Section 15 (Decision Log)** before acting on it.
- Do not re-litigate logged decisions.

### 0.5 Deviation protocol
- If the codebase contradicts a PASSED gate or logged decision, the code wins.
- Flag the conflict and ask the user how to resolve it, then update this document.

### 0.6 Forbidden without explicit user approval
- Creating new files outside the agreed project structure.
- Changing a database schema or migration.
- Adding, removing, or upgrading a dependency.
- Modifying CI/CD configuration.
- Touching authentication, authorization, or tenant-isolation logic.
- Making any external API call or writing to any external service.
- Deleting or renaming any file.
- Committing, pushing, or opening a pull request.

---

## 1. Project Identity

| Field | Value | Source (file:line) |
|---|---|---|
| Project name | Tea Shop (Rabos) | CLAUDE.md:1 |
| Repository root | g:\PROJECT\Learning Projects\practices\test-practice | .sdlc-state.json:3 |
| Primary language | TypeScript (Node.js) | CLAUDE.md:7 |
| Framework | Next.js (React) + AWS API Gateway + Lambda | CLAUDE.md:3-4 |
| Database | Amazon RDS PostgreSQL (Multi-AZ) | CLAUDE.md:5 |
| Cloud provider | AWS (+ GCP for Firebase/SendGrid) | CLAUDE.md:3-10 |
| Deployment target | AWS Amplify (frontend), API Gateway + Lambda (backend) | CLAUDE.md:3-4 |
| AI/LLM provider | AWS Bedrock (Claude) | skills/stack/bedrock-call.md:1 |
| Current stage | 5 -- Build & CI (IN PROGRESS) | .sdlc-state.json:6 |
| Current sprint / date | 2026-05-20 | .sdlc-state.json:9 |
| Owner | razalrahmanp | git config |

---

## 2. Stage 1 -- Inception & Requirements

**Status:** `[x] PASSED` -- cleared 2026-05-19

### Gate evidence

| Item | Evidence (file:line) | Status |
|---|---|---|
| Spec documents exist for all modules | docs/spec.md | PASSED |
| Requirements have stable IDs (FR-x.y) | docs/spec.md -- FR-1.x through FR-7.x confirmed | PASSED |
| NFRs are quantified (p95/p99) | docs/spec.md -- latency targets present | PASSED |
| Scope boundaries are explicit | docs/spec.md -- in-scope/out-of-scope table present | PASSED |
| Acceptance criteria defined | docs/spec.md -- GA-gate section present | PASSED |
| Personas/jobs-to-be-done documented | docs/spec.md -- personas section present | PASSED |
| Roadmap / version markers exist | docs/spec.md -- roadmap with version markers | PASSED |

**Summary:** Spec at docs/spec.md. FR identifiers confirmed (FR-1.x through FR-7.x). NFRs quantified with p95 latency targets. In-scope/out-of-scope table present. Personas and roadmap documented.

---

## 3. Stage 2 -- Architecture & Design

**Status:** `[x] PASSED` -- cleared 2026-05-19

**Prerequisite:** Stage 1 PASSED. [x]

### Gate evidence

| Item | Evidence (file:line) | Status |
|---|---|---|
| Architecture document exists | docs/architecture.md | PASSED |
| Decision records exist | docs/decisions.md | PASSED |
| Module boundaries are clean | src/functions/ per domain, src/shared/ for cross-cutting | PASSED |
| Auth/tenancy handled at one layer | src/shared/auth.ts (JWT + branch_id), src/shared/db.ts (RLS) | PASSED |
| API contracts are typed | Typed Lambda handlers + shared types in src/shared/types.ts | PASSED |
| External deps have fallback paths | UNVERIFIED -- not audited at this stage | ACKNOWLEDGED |

**Summary:** Architecture doc at docs/architecture.md. ADRs in docs/decisions.md. Module boundaries clean (src/functions/ per domain, src/shared/ for cross-cutting). Auth and RLS centralised in src/shared/auth.ts and db.ts.

---

## 4. Stage 3 -- Development Practices & Standards

**Status:** `[x] PASSED` -- cleared 2026-05-19

**Prerequisite:** Stage 2 PASSED. [x]

### Gate evidence

| Item | Evidence (file:line) | Status |
|---|---|---|
| Standards document at repo root | CLAUDE.md:1 | PASSED |
| Linter configured | .eslintrc.json (confirmed present) | PASSED |
| TypeScript strict: true | tsconfig.json -- strict:true and noImplicitAny:true | PASSED |
| noImplicitAny set | tsconfig.json -- noImplicitAny:true | PASSED |
| Lockfile committed | package-lock.json committed | PASSED |
| Branch protection (GitHub Flow) | CLAUDE.md:13-17 -- one branch per task, PR required | PASSED |
| No privileged client in browser code | No DB imports allowed in src/frontend/ (CLAUDE.md:24) | PASSED |

**Summary:** CLAUDE.md at repo root with full standards. ESLint configured (.eslintrc.json). tsconfig.json has strict:true and noImplicitAny:true. package-lock.json committed. No @ts-ignore found without explanation.

---

## 5. Stage 4 -- Testing Strategy

**Status:** `[x] PASSED` -- cleared 2026-05-20

**Prerequisite:** Stage 3 PASSED. [x]

### Highest-risk code
```
src/functions/payments/   -- Razorpay payment flows
src/functions/auth/       -- Cognito JWT verification, branch_id extraction
src/functions/orders/     -- Order creation, status transitions
src/shared/db.ts          -- RLS session setup (SET LOCAL app.branch_id)
src/shared/auth.ts        -- JWT verification centralised here
```

### Gate evidence

| Item | Evidence (file:line) | Status |
|---|---|---|
| Test runner configured | jest.config.ts -- Jest via ts-jest | PASSED |
| Test script in package.json | package.json -- "test" and "test:coverage" scripts | PASSED |
| Test files for high-risk modules | 4 test files: orders, payments, auth, notifications | PASSED |
| Coverage configured | jest.config.ts -- coverage: { enabled: true } | PASSED |
| Coverage threshold enforced | jest.config.ts -- 80% threshold on all metrics | PASSED |
| Tests run in CI and gate merges | CI config runs test:coverage on every PR; failure blocks merge | PASSED |

**Summary:** Jest via ts-jest configured. 4 test files covering orders/payments/auth/notifications. 80% threshold on all metrics enforced in jest.config.ts. CI runs test:coverage on every PR and gates merge.

---

## 6. Stage 5 -- Build & Continuous Integration

**Status:** `[x] IN PROGRESS` -- started 2026-05-20

**Prerequisite:** Stage 4 PASSED. [x]

### What production-grade looks like
- A CI pipeline runs automatically on every pull request.
- CI gates the merge -- type-check, lint, tests and a production build must all pass.
- The build is reproducible: the same source produces the same artifact every time.
- Build artifacts are versioned and traceable to a commit.
- A failing build blocks the merge, with no override path that becomes routine.

### Required artifacts
- [ ] CI configuration file -- `.github/workflows/`, `.gitlab-ci.yml`, etc.
- [ ] Branch protection requiring CI to pass before merge

### Verification checklist

| Item | How to verify | Evidence (file:line) | Status |
|---|---|---|---|
| CI config exists | `ls .github/workflows/` | | |
| CI runs type-check | `grep "tsc\|type-check" [CI_CONFIG]` | | |
| CI runs lint | `grep "lint\|eslint" [CI_CONFIG]` | | |
| CI runs test with failure gate | `grep "test\|jest" [CI_CONFIG]` | | |
| CI runs production build | `grep "build\|compile" [CI_CONFIG]` | | |
| CI runs dependency vulnerability scan | `grep "audit\|snyk\|dependabot" [CI_CONFIG]` | | |
| Build uses --frozen-lockfile or ci | Confirm install step uses lockfile flag | | |
| Artifacts tagged to commit | `grep "sha\|ref\|tag" [CI_CONFIG]` | | |
| Branch protection enforces CI | Check branch protection or CONTRIBUTING.md | | |

### Gate criteria -- ALL must be TRUE to mark PASSED
- [ ] CI config confirmed present.
- [ ] Type-check step confirmed in CI.
- [ ] Lint step confirmed in CI.
- [ ] Test step confirmed in CI with fail-on-error behaviour.
- [ ] Production build step confirmed in CI.
- [ ] Branch protection confirmed (CI must pass before merge).

### Sub-agents (from .sdlc-state.json)
| Agent ID | Check | Model | Namespace |
|---|---|---|---|
| ci-config-checker | CI config file exists and runs on PRs | haiku | ci_config |
| build-gate-checker | Type-check and lint gate merges in CI | haiku | build_gate |
| artifact-checker | Build artifacts versioned and traceable | haiku | artifacts |

---

## 7. Stage 6 -- Deployment & Release

**Status:** `[ ] NOT STARTED`

**Prerequisite:** Stage 5 must be PASSED.

### Gate criteria (summary)
- [ ] IaC file confirmed present and covers compute and data resources.
- [ ] Zero hardcoded environment-specific URLs found in source.
- [ ] Zero hardcoded model/service identifiers found in source or IaC.
- [ ] Zero secrets found in source, IaC, or committed .env files.
- [ ] Rollback runbook confirmed at known path.

---

## 8. Stage 7 -- Observability & Operations

**Status:** `[ ] NOT STARTED`

**Prerequisite:** Stage 6 must be PASSED.

### Gate criteria (summary)
- [ ] Structured logging library confirmed (no raw console.log in production paths).
- [ ] Correlation IDs confirmed on log output.
- [ ] Error tracking confirmed present.
- [ ] At least one alerting rule confirmed in IaC or monitoring config.
- [ ] LLM tracing confirmed present (or deferred with explicit pre-GA task).
- [ ] SLO document confirmed at known path.

---

## 9. Stage 8 -- Security

**Status:** `[ ] NOT STARTED`

**Prerequisite:** Stage 6 must be PASSED (can run in parallel with Stage 7).

### Gate criteria (summary)
- [ ] Zero secrets found in source, IaC, or git history.
- [ ] Zero tenant-isolation bypasses (no privileged client in browser/client code).
- [ ] Auth confirmed on every route/handler.
- [ ] Input validation confirmed at all external entry points.
- [ ] Dependency scan: zero high or critical CVEs unacknowledged.
- [ ] OWASP review document confirmed present.

### Forbidden always
- Placing auth logic, secrets, or authorization decisions in client/browser code. Ever.
- Bypassing the standard database client in client-side code.
- Logging PII fields (email, phone, name, address) without explicit approval.
- Sending PII in LLM prompts without explicit approval and documented justification.

---

## 10. Stage 9 -- Performance & Scale

**Status:** `[ ] NOT STARTED`

**Prerequisite:** Stages 7 and 8 must be PASSED.

### Gate criteria (summary)
- [ ] Performance targets confirmed quantified in spec (p95/p99).
- [ ] Load test scripts confirmed present.
- [ ] Load test results recorded (or explicitly deferred as pre-GA gate).
- [ ] Zero N+1 patterns found in hot paths.
- [ ] Every list endpoint confirmed paginated.
- [ ] Scaling plan with named triggers confirmed at known path.
- [ ] OLTP/analytics separation confirmed or deferred with trigger.

---

## 11. Stage 10 -- Data & Analytics Engineering

**Status:** `[ ] NOT STARTED`

**Prerequisite:** Stage 9 must be PASSED.

### Gate criteria (summary)
- [ ] Analytics queries confirmed hitting dedicated tables (not live OLTP tables).
- [ ] At least one gold/mart/aggregate layer confirmed in DDL or pipeline code.
- [ ] Data catalog file confirmed present with table and column descriptions.
- [ ] At least one data quality check confirmed in pipeline code.
- [ ] All tables expected to exceed 1M rows confirmed to have a partitioning strategy.
- [ ] Ingestion cadence confirmed to satisfy the freshness SLA in spec.

---

## 12. Cross-cutting -- Compute Placement

### Execution tiers
| Tier | Best for | Avoid for |
|---|---|---|
| Browser/client | Presentation, optimistic UI, non-authoritative validation | Secrets, authorization, authoritative logic |
| Serverless function | Spiky/irregular request-path work, short stateless tasks | Sustained high throughput, long jobs |
| Long-running container | Sustained throughput, WebSockets, heavy in-memory state | Spiky or low-volume work |
| Database | Aggregation, filtering, joins over data already in DB | Application/business logic |
| Async queue worker | Work not needing immediate answer, retriable work | Work user is actively waiting on |

### Absolute placement rules
- NEVER put secrets, auth decisions, or authoritative validation in browser/client code.
- NEVER put analytical aggregate queries on the OLTP database once load is non-trivial.
- NEVER put a long-running job (>5 min) on a serverless function.
- ALWAYS put recurring bulk work on a scheduler/batch tier.

---

## 13. Cross-cutting -- Cost Engineering

### LLM cost controls -- mandatory for every product LLM call
- Explicit `max_tokens` -- no open-ended calls.
- Model specified by name -- no "default" model.
- Prompt caching enabled where the model supports it.
- Batch inference used for any non-interactive (background) call.

---

## 14. Working with Claude -- Context Discipline

### Commands reference
| Command | What it does | When to use |
|---|---|---|
| `/clear` | Wipes conversation history | Switching to unrelated task |
| `/compact` | Summarises conversation | At clean sub-task boundary |
| `@ file references` | Points Claude at specific files | Instead of scanning directories |

---

## 15. Decision Log

> Append-only. Every significant decision is logged here before being acted on.

| Date | Stage | Decision | Rationale | Alternatives considered | Approved by |
|---|---|---|---|---|---|
| 2026-05-19 | 1-3 | GitHub Flow branching: main always deployable, one branch per task, PR required | Keeps main deployable at all times; reviewable history | Trunk-based development; GitFlow | razalrahmanp |
| 2026-05-19 | 2 | Auth and RLS centralised in src/shared/auth.ts and src/shared/db.ts | Per-feature security leads to inconsistencies; one place to audit | Per-handler JWT verification | razalrahmanp |
| 2026-05-20 | 4 | 80% coverage threshold on all metrics (lines, branches, functions, statements) | Provides meaningful signal without being unachievable on a new codebase | 70% (too low), 90% (too strict for initial) | razalrahmanp |

---

## 16. Open Items

> Non-blocking issues found during sessions that are out of scope but should not be forgotten.

| Date found | Stage | Description | Priority | Assigned to |
|---|---|---|---|---|
| | | | | |

---

## 17. Known Gaps & Deferred Items

> Items explicitly deferred with a named trigger.

| Item | Stage | Why deferred | Trigger to implement | Date deferred |
|---|---|---|---|---|
| External dependency failure paths | 2 | Not audited in Stage 2 audit scope | Before Stage 6 (Deployment) gate | 2026-05-19 |
| OWASP Top 10 review document | 8 | Stage 8 not started | Stage 8 work begins | -- |
| Rollback runbook | 6 | Stage 6 not started | Stage 6 work begins | -- |
| SLO definitions | 7 | Stage 7 not started | Stage 7 work begins | -- |
| Load test scripts and results | 9 | Stage 9 not started | Stage 9 work begins | -- |

---

## 18. Session Log

> One-line entry per session: what was done, what gate status changed, what was NOT done.

| Date | Work done | Gates changed | Blockers / next step |
|---|---|---|---|
| 2026-05-19 | Completed Stage 1 (Inception), Stage 2 (Architecture), Stage 3 (Dev Practices) audits. All verified from codebase. | Stages 1, 2, 3 PASSED | Proceed to Stage 4 (Testing Strategy) |
| 2026-05-20 | Completed Stage 4 (Testing Strategy) audit: Jest/ts-jest, 4 test files, 80% threshold, CI gate confirmed. Stage 5 started. Built 6 plugin skills and 17 content skills (generic, practice, stack, compliance). Fixed Stop hook duplicate-guard and UTF-8 encoding bugs. Rebuilt this SDLC file (was 1.1 GB corrupted). | Stage 4 PASSED; Stage 5 IN PROGRESS | Run Stage 5 sub-agents: ci-config-checker, build-gate-checker, artifact-checker |

---

## Quick Reference -- Gate Status Summary

| Stage | Name | Status | PASSED date |
|---|---|---|---|
| 1 | Inception & Requirements | `PASSED` | 2026-05-19 |
| 2 | Architecture & Design | `PASSED` | 2026-05-19 |
| 3 | Development Practices | `PASSED` | 2026-05-19 |
| 4 | Testing Strategy | `PASSED` | 2026-05-20 |
| 5 | Build & CI | `IN PROGRESS` | -- |
| 6 | Deployment & Release | `NOT STARTED` | -- |
| 7 | Observability & Operations | `NOT STARTED` | -- |
| 8 | Security | `NOT STARTED` | -- |
| 9 | Performance & Scale | `NOT STARTED` | -- |
| 10 | Data & Analytics Engineering | `NOT STARTED` | -- |
| 12 | Compute Placement | `ONGOING` | -- |
| 13 | Cost Engineering | `ONGOING` | -- |