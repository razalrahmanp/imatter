# SDLC Validate — Complete Design Document

> Consolidated from a multi-turn design conversation. Captures the architecture, agents, skills, MCP tools, hooks, integrity layer, upgrade strategy, and open questions for the SDLC Validate framework.
>
> **Status (2026-05-20):** ~85% built. 20 MCP tools live, 35 sub-agents in `plugin/agents/`, 116 skills in `plugin/skills/`, marketplace.json wired with `commands` + `skills` + `agents` fields. Production-coding flow + parallel-dispatch tooling still pending. See Section 19 for the honest accounting.
>
> **Project context:** RABOS Technologies Pvt Ltd. RABOS is a multi-tenant ERP for Indian SMBs. SDLC Validate is being built initially for RABOS internal use, with the global open-source framework as the long-term direction.

---

## 1. Origin and Goal

### 1.1 The problem
- Quality is currently held together by founder knowledge.
- Single-founder + AI doesn't scale past a few modules.
- Need a structural discipline layer that lets RABOS ship modules with consistent rigor.
- And, ideally, becomes a framework other teams can adopt.

### 1.2 The core insight
**State is durable. Conversations are ephemeral. Build coordination through state, not through conversation.**

This is the design pillar that distinguishes SDLC Validate from simpler audit frameworks. The framework is the *external memory system* that makes conversation history irrelevant — every load-bearing fact lives on disk, accessible via tools.

### 1.3 Two products in one framework
1. **Audit mode** — read-only verification of a codebase against gate criteria.
2. **Production coding mode** — gated, disciplined writing of new code with the same state discipline.

Audit ships first (v1.0). Coding ships in v1.1.

---

## 2. Architecture Overview

### 2.1 The 10 + 2 structure
- **10 sequential stages** (1–10): Inception → Architecture → Dev Practices → Testing → Build/CI → Deployment → Observability → Security → Performance → Data Engineering
- **2 cross-cutting concerns** (12, 13): Compute Placement, Cost Engineering (run continuously, not gated)

### 2.2 Per-stage shape (4 parts)
Every stage in `SDLC_VALIDATION.md` has the same structure:
1. **What production-grade looks like** — narrative
2. **Audit checklist** — table of "Item / How to verify / Why it matters / Evidence / Status"
3. **Required artifacts** — files that must exist
4. **Gate criteria** — ALL must be TRUE to mark PASSED
5. **Forbidden until gate is PASSED** — explicit restrictions

### 2.3 The fixed-budget session principle
Each stage runs in its own fresh Claude session via `sdlc_init`, which loads:
- ~5 lines cursor state
- ~2 lines × N history summaries (grows linearly by 2 lines per completed stage)
- One SDLC section slice
- Named import values only (frontmatter parse, ~50 tokens each)

Stage 8 session costs roughly the same as Stage 2 session. The prior stages' full conversations and findings docs never re-enter context.

### 2.4 Three layers preventing context rot
- **Layer 1 — Session isolation:** Each stage = fresh session, fixed-budget payload.
- **Layer 2 — Sub-agent offloading:** Sub-agents run in own context windows; only ~100-token finding payloads return to orchestrator via `sdlc_agent_write`.
- **Layer 3 — Module memory:** Findings persisted in two places: `state.json memory[ns]` (structured) and `sNN-findings.md` frontmatter (extractable). Stage N+1 never loads Stage N's full findings doc.

---

## 3. State File — The Single Source of Truth

### 3.1 Location and structure
**Path:** `.sdlc-state.json` at project root (sibling to `SDLC_VALIDATION.md`).

```json
{
  "schema": "sdlc-state/1.0",
  "framework_version": "1.0.3",
  "project_root": "/absolute/path",
  "sdlc_file": "SDLC_VALIDATION.md",

  "cursor": {
    "stage": 5,
    "status": "in_progress",
    "fail_count": 0,
    "started_at": "2026-05-20T10:14:00Z",
    "hmac": "a3f2c1d4..."
  },

  "history": [
    {
      "stage": 1,
      "name": "Inception & Requirements",
      "gate": "PASSED",
      "cleared_at": "2026-05-18",
      "verified_with_framework_version": "1.0.3",
      "summary": "15-practice curriculum defined. Tech stack: SQL/Python/PySpark.",
      "doc": ".sdlc-sessions/s01-findings.md",
      "doc_sha256": "5f3d7e2a...",
      "exports": ["curriculum_scope", "tech_stack"],
      "evidence_status": "fresh",
      "verdict_basis": {
        "checked_files": [
          { "path": "package.json", "sha256": "8b2a..." }
        ],
        "checked_commands": [],
        "memory_snapshot_hash": "a5c8..."
      },
      "hmac": "b8e4f1a2..."
    }
  ],

  "stages": {
    "5": {
      "name": "Build & CI",
      "imports": [
        { "stage": 3, "key": "linter_config" },
        { "stage": 4, "key": "ci_test_command" }
      ],
      "sub_agents": [
        { "id": "ci-type-check",   "check": "tsc step",  "model": "haiku",  "ns": "type_check" },
        { "id": "ci-lint",         "check": "lint step", "model": "haiku",  "ns": "lint" },
        { "id": "ci-test-gate",    "check": "test step", "model": "haiku",  "ns": "test_gate" },
        { "id": "ci-build",        "check": "build step","model": "haiku",  "ns": "build" },
        { "id": "ci-branch-prot",  "check": "branch protection", "model": "sonnet", "ns": "branch_prot" }
      ],
      "memory": {
        "type_check": null, "lint": null, "test_gate": null, "build": null, "branch_prot": null
      },
      "gate": {
        "rule": "all_criteria_met",
        "criteria": [
          { "ns": "type_check", "must": "pass" },
          { "ns": "lint",       "must": "pass" },
          { "ns": "test_gate",  "must": "pass" },
          { "ns": "build",      "must": "pass" },
          { "ns": "branch_prot","must": "pass_or_acknowledge" }
        ],
        "conflict_threshold": 2
      }
    }
  },

  "flagged": [],

  "_signature": {
    "algorithm": "HMAC-SHA256",
    "computed_at": "2026-05-20T11:42:13Z",
    "value": "9c2e7d4f..."
  }
}
```

### 3.2 Key parts and their purpose
- **cursor** — single source of truth for `sdlc_init`. Status enum: `in_progress | gate_failed | awaiting_review`. When `fail_count` reaches 2, status flips to `awaiting_review` and stage pushed to `flagged[]` — no auto-retry.
- **history[]** — append-only, written only after gate clears. Each entry has 2–3 sentence summary, path to full findings doc.
- **exports + imports** — explicit dependency graph between stages. Stage 5 declaring `{ stage: 3, key: "linter_config" }` means `sdlc_init` loads one value from `s03-findings.md` frontmatter, not the whole file.
- **memory[ns]** — namespace isolation per sub-agent. Each writes only to its own key. Gate synthesis reads all keys.
- **flagged[]** — human review queue. `sdlc_init` checks this before doing anything.

### 3.3 Atomic write protocol
1. Run all sub-agents → fill memory[ns] keys
2. Run gate synthesis
3. If gate PASSES:
   a. Flush step findings to `.sdlc-sessions/sNN-findings.md`
   b. Write `.sdlc-state.json.tmp` with updated history[] + cursor.stage++
   c. Rename `.sdlc-state.json.tmp` → `.sdlc-state.json` (atomic on both Windows and Linux)
4. If gate FAILS:
   a. Increment cursor.fail_count
   b. If fail_count >= 2: push to flagged[], set status = awaiting_review
   c. Else: set status = gate_failed
   d. Write .sdlc-state.json.tmp → rename (same atomic pattern)

**Rule:** never write directly to the state file — a crash mid-write leaves a valid prior state intact.

### 3.4 What `sdlc_init` loads (fixed budget)
| What | Size |
|---|---|
| cursor block | ~5 lines |
| history[].summary (all) | ~2 lines × N stages |
| Next stage's SDLC section | 1 section slice |
| Named import values only | 1 value per declared import |
| Protocol rules (from MCP constant) | hardcoded, not re-read |

Stage 8 session ≈ Stage 2 session in token cost.

---

## 4. Findings Documents

### 4.1 Frontmatter structure
```markdown
---
stage: 1
name: "Inception & Requirements"
gate: "PASSED"
cleared_at: "2026-05-18"
exports:
  tech_stack: ["SQL", "Python", "PySpark", "PostgreSQL"]
  curriculum_scope: "15-practice curriculum. Sections 1–15 defined."
  team_size: 1
---

# Stage 1 Findings: Inception & Requirements

[prose narrative for human reading — sdlc_init never loads this unless explicitly requested]
```

### 4.2 Export rules
- Export values must be scalars or flat arrays.
- For structured data, use a path pointer: `db_schema_ref: ".sdlc-sessions/s03-findings.md#schema-decisions"`
- That way the import stays single-token-cheap, but the dependent stage can follow the pointer if it genuinely needs depth.

### 4.3 Sub-agent finding payload (what each writes)
```json
{
  "status": "pass" | "fail" | "partial" | "uncertain",
  "summary": "tsconfig.json: strict=true, noImplicitAny=true, no @ts-ignore present.",
  "artifacts": ["tsconfig.json:1", ".eslintrc.json:14"],
  "flags": []
}
```

Gate synthesis reads `status + artifacts` for gate logic. `summary` goes into rolled-up session summary. `flags` are non-blocking observations logged to open items.

---

## 5. Gate Synthesis

### 5.1 Gate criteria types
- **`pass`** — status must equal "pass". Anything else = hard fail.
- **`pass_or_acknowledge`** — status in ["pass", "acknowledged"]. Other = hard fail.
- **`warn_ok`** — any status accepted, surface value in summary.

### 5.2 4-level gate states (added from levnikolaevich pattern)
- **PASS** — all criteria met, no unresolved conflicts.
- **CONCERNS** — passes overall but with non-blocking warnings.
- **FAIL** — at least one hard-fail criterion not met. Increment fail_count.
- **WAIVED** — explicitly accepted with documented reason. Tracked separately.

### 5.3 Conflict resolution
- A conflict = two ns keys make contradictory claims about the same artifact.
- Detection: each sub-agent tags its finding with artifact refs (file paths, config keys).
- If refs overlap and conclusions differ → conflict.
- If conflicts >= `conflict_threshold` → run Sonnet synthesis pass.
- Sonnet gets: conflicting ns payloads only (not full docs). Returns: resolved verdict + rationale.

### 5.4 Quality score (added from agentic-sdlc pattern)
- Numerical score 0–100 per stage alongside the verdict.
- Threshold 85 for PASS by default (configurable).
- Lets you trend quality across releases, not just "did the gate pass."

---

## 6. SDLC Document Section Extraction

### 6.1 Reject line numbers
Line-number indices are fragile. Every edit to `SDLC_VALIDATION.md` invalidates them.

### 6.2 Use heading-based extraction
```typescript
export function getSdlcSection(content: string, heading: string): string {
  const start = content.indexOf(`## ${heading}`);
  const nextSection = content.indexOf("\n## ", start + 4);
  return nextSection === -1 ? content.slice(start) : content.slice(start, nextSection);
}
```

Stage index in state.json stores heading strings:
```json
"stages": {
  "4": {
    "sdlc_heading": "5. Stage 4 — Testing Strategy"
  }
}
```

One full-file read per session start; getSdlcSection short-circuits at first `\n## ` after match.

---

## 7. MCP Tools

### 7.1 Already built (4)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 1 | `sdlc_state_create` | Bootstraps `.sdlc-state.json` from Quick Reference | Once, at project init |
| 2 | `sdlc_init` | Assembles fixed-budget session context (cursor + summaries + named imports + SDLC section) | Every Claude session start |
| 3 | `sdlc_agent_write` | Namespace-isolated sub-agent finding writer; atomic | Every sub-agent on completion |
| 4 | `sdlc_gate_run` | Synthesizes gate verdict; advances cursor on PASS; fail-counts and flags on repeat FAIL | After all sub-agents in a stage finish |

### 7.2 Designed for production coding (3)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 5 | `sdlc_skills_fetch` | Reads `skills/{task_type}.md`, returns first `##` section only (~200 tokens) | Writer agent before any code write |
| 6 | `sdlc_task_checkpoint` | Flushes writer state to `task-plan.json`; returns compact context for next iteration | After each verifier round in a writer loop |
| 7 | `sdlc_error_diagnose` | Classifies verifier error output; returns structured payload with exact lines | When verifier fails; before retry |

### 7.3 Designed for parallel + compact (3)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 8 | `sdlc_dispatch_agents` | Spawns sub-agents async; returns dispatch_id immediately | Stage start: dispatch all checks in parallel |
| 9 | `sdlc_dispatch_status` | Returns current status of dispatch (running/complete/failed) | Polling for completion |
| 10 | `sdlc_dispatch_wait` | Blocks until all sub-agents complete (with timeout) | When orchestrator needs sync before gate |

### 7.4 Designed for state integrity (2)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 11 | `sdlc_verify_history` | Re-checks verdict_basis hashes against current disk; marks stale evidence | `sdlc_init` calls this; also on-demand |
| 12 | `sdlc_admin_override` | Logged manual override of state with reason (audit trail) | When genuine override needed |

### 7.5 Designed for client upgrades (3)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 13 | `sdlc_migrate_check` | Pre-flight check showing what an upgrade would change | Before applying any upgrade |
| 14 | `sdlc_migrate_apply` | Runs migration scripts; preserves user regions; backs up first | Applying a framework version upgrade |
| 15 | `sdlc_migrate_rollback` | Restores from `.sdlc-backups/` within 30-day window | When an upgrade needs reverting |

### 7.6 Designed for traceability/quality (3)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 16 | `sdlc_trace_requirements` | Maps FR-x.y.z requirements in spec docs to tests; surfaces untested requirements | Stage 4 audit gate criterion |
| 17 | `sdlc_spec_compliance` | Compares produced code against task description and design spec | After writer completes, before commit |
| 18 | `sdlc_design_drift` | Compares production UI against Figma source via Figma MCP; surfaces diffs | Weekly drift check on UI tier |

### 7.7 Summary
**Total: 18 tools. 4 built, 14 designed.**

---

## 8. Agents

### 8.1 Audit agent types (8) — reused across all 10 stages

| # | Agent type | Model | Reused in stages |
|---|---|---|---|
| 1 | file-finder | Haiku | 1, 2, 6, 7, 8 |
| 2 | config-reader | Haiku | 3, 5, 7 |
| 3 | grep-checker | Haiku | 1, 3, 4, 5, 6, 8, 9 |
| 4 | dep-scanner | Haiku | 3, 5, 8 |
| 5 | secret-scanner | Haiku | 6, 8 |
| 6 | boundary-analyzer | Sonnet | 2, 3, 8 |
| 7 | pattern-consistency-checker | Sonnet | 3, 9, 10 |
| 8 | gate-synthesizer | Sonnet (Opus on conflict) | every stage |

### 8.2 Production coding agents (8)

| # | Agent | Model | Role |
|---|---|---|---|
| 9 | planner | Sonnet | Task decomposition → task-plan.json |
| 10 | skills-fetcher | Haiku | Reads SKILL.md, injects pattern |
| 11 | writer | Sonnet | One per file being changed |
| 12 | verifier | Haiku→Sonnet | Runs tsc/lint/test |
| 13 | error-handler | Sonnet | Diagnoses errors, routes to writer |
| 14 | test-writer | Sonnet | Writes tests for new code |
| 15 | context-manager | Sonnet | Token budget, triggers compact |
| 16 | doc-updater | Haiku | Updates docs when scope changes |

### 8.3 Quality enforcement agents (7)

| # | Agent | Model | Role |
|---|---|---|---|
| 17 | spec-compliance-verifier | Sonnet | Code matches task description? |
| 18 | plan-critic | Sonnet | Reviews plan before any writer runs |
| 19 | scope-guard | Haiku | Blocks out-of-scope diffs |
| 20 | migration-writer | Sonnet | DDL changes only (special discipline) |
| 21 | sensitive-path-guard | Sonnet | auth/migrations/.env paths |
| 22 | release-orchestrator | Sonnet | Post-commit (PR, deploy, monitoring) |
| 23 | requirements-tracer | Sonnet | FR-x.y.z to test mapping |

### 8.4 Integration agents (4)

| # | Agent | Model | Role |
|---|---|---|---|
| 24 | docs-researcher | Sonnet | Calls Context7 for current library docs |
| 25 | e2e-live-verifier | Sonnet | Uses Playwright MCP for live UI test |
| 26 | sdlc-dispatcher | Sonnet | Auto-trigger at session start |
| 27 | design-drift-detector | Sonnet | Production UI vs Figma source |

### 8.5 UI agents (2)

| # | Agent | Model | Role |
|---|---|---|---|
| 28 | ui-aesthetic-enforcer | Sonnet | Strips AI-generic patterns |
| 29 | accessibility-auditor | Sonnet | WCAG 2.1 AA verification |

### 8.6 Lifecycle agents (2)

| # | Agent | Model | Role |
|---|---|---|---|
| 30 | migration-applier | Sonnet | Runs framework version migrations |
| 31 | upgrade-pre-flight | Sonnet | Pre-flight check before framework upgrade |

### 8.7 Summary
**31 agent types total. 4 instances built (for Stage 4: test-runner-checker, test-files-checker, coverage-checker, ci-gate-checker). 27 types designed but not implemented.**

Model distribution: 8 Haiku, 22 Sonnet, 1 Opus (only on confirmed disagreement).

---

## 9. Skills Library

### 9.1 Layer breakdown (106 skills total, 0 built)

| Layer | Count | Scope |
|---|---|---|
| L1 Generic | 28 | Stack-agnostic, region-agnostic |
| L2 Tool/practice | 14 | Engineering process patterns |
| L3 Stack (react-supabase-lambda) | 22 | RABOS's stack |
| L4 RABOS project overlay | 10 | RABOS business logic only |
| L5 Compliance (5 modules) | 19 | Per-compliance-regime patterns |
| L6 UI-specific | 12 | Frontend / design |
| L7 Compaction | 1 | Context discipline |

### 9.2 Generic skills (L1, 28)
**API & contracts (5):** api-endpoint-design, api-versioning, idempotency-keys, rate-limiting, webhook-receiver

**Data handling (5):** input-validation, pii-handling, secret-handling, data-retention, audit-logging

**Reliability (5):** error-handling, retry-with-backoff, circuit-breaker, timeout-budgets, graceful-degradation

**Observability (4):** structured-logging, distributed-tracing, metrics-design, slo-definition

**Security (4):** authn-pattern, authz-pattern, tenant-isolation, owasp-top10-checklist

**Testing (5):** unit-test-pattern, integration-test-pattern, e2e-test-pattern, test-fixture-design, mocking-strategy

### 9.3 Tool/practice skills (L2, 14)
**Code quality (5):** code-review-checklist, commit-message-convention, pr-description-template, refactoring-safety, tech-debt-tracking

**Process (5):** decision-record, incident-response, postmortem-blameless, runbook-pattern, oncall-handoff

**Documentation (4):** readme-structure, architecture-doc, api-doc-pattern, changelog-pattern

### 9.4 Stack-specific skills (L3, 22)
**Database & data (5):** supabase-rls, supabase-migration, pgvector-pattern, postgres-partition, materialized-view

**Compute & workers (5):** lambda-worker, sqs-trigger, lambda-cold-start, eventbridge-pattern, step-function-pattern

**LLM/AI (5):** bedrock-call, bedrock-batch-inference, bedrock-tpm-management, prompt-injection-defense, agent-response-contract

**Frontend (4):** react-component, react-data-fetching, react-state-management, react-error-boundary

**Infrastructure (3):** serverless-yml-pattern, cloudfront-cache, cognito-jwt-validation

### 9.5 RABOS project overlay (L4, 10)
**Modules (5):** insight-rule, semantic-dsl, connector-interface, posting-rule, geocoding-pipeline

**Conventions (5):** coa-collision-check, rabos-tenant-context, rabos-event-shape, rabos-feature-flag, rabos-brand-system

### 9.6 Compliance skills (L5, 19)
**GDPR (4):** data-subject-rights, dpa-pattern, cross-border-transfer, consent-management

**EU AI Act (4):** ai-risk-classification, ai-transparency-disclosure, ai-system-logging, ai-human-oversight

**SOC 2 (3):** change-management-evidence, access-review-pattern, incident-evidence

**HIPAA (4):** phi-handling, phi-access-logging, baa-pattern, breach-notification

**PCI DSS (4):** card-data-tokenization, pan-truncation, pci-scope-reduction, pci-network-segmentation

### 9.7 UI-specific skills (L6, 12)
design-spec-jsonc, accessibility-wcag, web-vitals, bundle-budget, motion-preference, design-system-tokens, design-drift-audit, visual-regression-pattern, react-design-tokens, react-aria-pattern, react-motion-library, rabos-component-library

### 9.8 Skill file format
```markdown
---
id: lambda-worker
title: "Lambda worker — six-step pattern"
tags: [aws, lambda, worker, async, rabos-stack]
applies_to:
  task_types: [add-worker, modify-worker, debug-worker]
  stages: [3, 5, 7]
size_tokens: 280
version: 1.0.3
---

# Lambda worker — six-step pattern

## Pattern summary
[200-token compressed summary — this is what sdlc_skills_fetch returns]

## Full reference
[Detailed examples, code snippets, edge cases — only loaded on explicit request]

## When NOT to use
[Anti-patterns, alternatives]

## Related skills
- sqs-trigger
- agent-response-contract
- structured-logging
```

### 9.9 Build priority
- **Tier 1 (before stage 5 audit ends):** bedrock-call, supabase-rls, lambda-worker, pii-handling, secret-handling (~5 skills)
- **Tier 2 (before production coding):** all of L1 + L2 (~42 skills)
- **Tier 3 (before global launch):** L3 stack (22) + 3 launch compliance modules
- **Tier 4 (community contribution):** everything else

---

## 10. Hooks

### 10.1 The four hook contracts

#### SessionStart hook (Claude Code level)
Auto-loads cursor + history summaries into Claude's context at conversation start. Makes the dispatcher feel automatic; `sdlc_init` MCP becomes the *active* form, this is the *ambient* form.

```bash
# .sdlc/hooks/session_start.sh
CURSOR=$(sdlc state get cursor --format json)
HISTORY_SUMMARIES=$(sdlc state get history --summaries-only --format json)
FRAMEWORK_VERSION=$(git config sdlc.framework-version)

# Inject into Claude's context via SessionStart payload
```

#### PreToolUse hook (policy enforcement)
Every tool call passes through. Blocks writes to sensitive paths without explicit approval. Scans tool input for secret patterns. Emits decision ID on denial.

```bash
# .sdlc/hooks/pre_tool_use.sh
# Reads tool call payload from stdin
# Enforces policy.yaml rules
# Exits non-zero to block the tool call
```

#### Stop hook (session log writer)
Writes session log entry from state.json. Critical: Claude is never involved in this write. One row per calendar day with deduplication.

```powershell
# Reads .sdlc-state.json
# Writes one row to SDLC_VALIDATION.md:Section 18
# Deduplicates on date
```

#### post_merge git hook
Fires after merge to main. Closes the merged task, refreshes affected stages' evidence hashes, flags stale evidence.

### 10.2 Governance configuration

**`.sdlc/governance/policy.yaml`:**
```yaml
sensitive_paths:
  - pattern: "**/auth/**"
    requires: [human_approval, two_agent_review]
    skills: ["authn-pattern", "authz-pattern"]
  - pattern: "supabase/migrations/**"
    requires: [migration_writer_only, human_approval]
  - pattern: "**/*.env*"
    requires: [denied]

secret_patterns:
  - "AWS_ACCESS_KEY_ID=[A-Z0-9]{20}"
  - "sk-ant-[A-Za-z0-9]{40,}"
  - "eyJ[A-Za-z0-9-_=]+\\.eyJ[A-Za-z0-9-_=]+\\.[A-Za-z0-9-_.+/=]*"
```

**`.sdlc/governance/reviewers.yaml`:**
```yaml
stage_reviewers:
  4: { required: [role:engineering-lead] }
  5: { required: [role:devops] }
  8: { required: [role:security-engineer], minimum: 1 }

task_reviewers:
  default: codeowners
  sensitive_paths:
    "**/auth/**": [security-team]
    "**/migrations/**": [database-team, engineering-lead]
```

### 10.3 The naming distinction
- **`sdlc init`** (CLI, one-time per project) → bootstrap governance, install hooks, set up CI
- **`sdlc_init`** (MCP tool, every Claude session) → load cursor state for current session

Two surfaces, similar names. Worth documenting clearly.

---

## 11. Integrity and Tamper-Resistance

### 11.1 The attack surface
- User manually edits `.sdlc-state.json` to flip PASSED
- User edits `sNN-findings.md` frontmatter to fake values
- User modifies Quick Reference table claiming stages cleared
- User edits session log Section 18 to fake history
- State file gets corrupted or merge-conflicted
- Two concurrent sessions writing contradictory state
- Code changes after gate passed but state still says PASSED

### 11.2 Defense 1 — HMAC-protected state
Every history entry and the cursor block have HMAC signatures. The top-level state file has a signature. Findings docs are hashed and the hash stored in history entry.

```json
{
  "history": [{
    "stage": 4,
    "doc_sha256": "5f3d...",
    "findings_hash": "e7b9...",
    "memory_hash": "f4d2...",
    "signed_by": "sdlc_gate_run@v1.0.3",
    "hmac": "b8e4..."
  }],
  "_signature": {
    "algorithm": "HMAC-SHA256",
    "key_source": ".sdlc/keys/state.key (gitignored, machine-local)",
    "value": "9c2e..."
  }
}
```

`sdlc_init` validates the entire chain on session start.

### 11.3 Defense 2 — Gate re-execution proof (drift detection)
Every history entry stores `verdict_basis` — fingerprints of what was checked:

```json
"verdict_basis": {
  "checked_files": [
    { "path": "jest.config.ts", "sha256": "5f3d..." },
    { "path": ".github/workflows/ci.yml", "sha256": "c4e1..." }
  ],
  "checked_commands": [
    { "cmd": "npm audit --audit-level=high", "exit_code": 0, "output_hash": "9d7f..." }
  ]
}
```

`sdlc_verify_history` re-checks: if any `checked_files[i].sha256` doesn't match disk → mark `evidence_status: "stale"`.

### 11.4 Defense 3 — Append-only event log
`.sdlc-events.log` — never overwritten, append-only:
```
2026-05-20T10:14:00Z | sdlc_init | cursor.stage=5 | actor=session-abc123 | prev_hmac=null | new_hmac=a3f2c1d4
2026-05-20T11:42:13Z | sdlc_gate_run | stage=4 verdict=PASSED | actor=session-abc123 | prev_hmac=a3f2c1d4 | new_hmac=b8e4f1a2
```

Each line carries prior and new HMAC. Chain breaks if log is tampered.

### 11.5 Defense 4 — Read-only Quick Reference
The Quick Reference in SDLC_VALIDATION.md is regenerated from state.json by Stop hook. Manual edits overwritten next session. State.json is the single source of truth.

### 11.6 Defense 5 — Concurrent session safety
`.sdlc-state.lock` created on session start, removed on session end. Stale lock detection by PID check. `--force` flag to override.

### 11.7 Defense 6 — Admin override path
`sdlc_admin_override` for legitimate edits. Logged with reason. Marked `manually_overridden: true` in history. Surfaced in every future `sdlc_init` output.

---

## 12. Stack Profiles and Compliance Modules

### 12.1 Stack profile system
```json
// .sdlc-stack.json
{
  "stack": "react-supabase-lambda",
  "language": "typescript",
  "test_runner": "jest",
  "ci_provider": "github-actions",
  "deployment_target": "aws-lambda",
  "llm_provider": "bedrock"
}
```

SDLC_VALIDATION.md uses `[STACK_SPECIFIC]` placeholders that the profile fills in.

### 12.2 Registry structure
```
sdlc-validate/
├── core/                          # Framework, stack-agnostic
├── stages/                        # The 10 stages + 2 cross-cutting
│   ├── 01-inception.yaml
│   ├── ...
│   └── 13-cost.yaml
└── registries/
    ├── stacks/
    │   ├── react-supabase-lambda/
    │   ├── nextjs-prisma-vercel/
    │   ├── django-postgres-aws/
    │   ├── spring-boot-postgres/
    │   ├── golang-postgres-gcp/
    │   └── dotnet-sqlserver-azure/
    ├── compliance/
    │   ├── gdpr/
    │   ├── ccpa/
    │   ├── hipaa/
    │   ├── soc2/
    │   ├── pci-dss/
    │   ├── iso27001/
    │   ├── eu-ai-act/
    │   ├── nist-ai-rmf/
    │   ├── wcag-2-1-aa/
    │   └── accessibility-eu/
    └── skills/
        ├── generic/
        └── stack-specific/
```

### 12.3 Launch compliance modules (5 + accessibility pair)
- GDPR (EU)
- SOC 2 (US enterprise floor)
- ISO 27001 (global infosec)
- PCI DSS (anyone touching payments)
- EU AI Act + NIST AI RMF (AI compliance pair)
- WCAG 2.1 AA + accessibility-eu + accessibility-us (legally mandatory in many regions)

### 12.4 Use case
```bash
# RABOS:
sdlc init --stack react-supabase-lambda --compliance gdpr,dpdp-india,eu-ai-act,gst-india

# EU fintech:
sdlc init --stack spring-boot-postgres-aws --compliance gdpr,pci-dss,iso27001 --region eu-central

# US healthcare:
sdlc init --stack nextjs-prisma-vercel --compliance hipaa,soc2,iso27001
```

---

## 13. Integration with Other Plugins

### 13.1 Required co-dependencies
SDLC Validate is positioned as the orchestration layer that uses these as capabilities:

| Plugin | Provides | Used by |
|---|---|---|
| Superpowers | Production coding methodology (TDD, brainstorming, planning, debugging) | Planner, writer, verifier flow |
| Playwright MCP | Browser-level verification (E2E, accessibility, UI QA) | e2e-live-verifier agent |
| Context7 | External library documentation freshness | docs-researcher agent |
| Figma MCP | Design source-of-truth | Writer agent for UI tasks |
| Frontend Design (Anthropic official) | Aesthetic quality enforcement | ui-aesthetic-enforcer agent |
| Web Design Guidelines (Vercel Labs) | WCAG compliance enforcement | accessibility-auditor agent |

### 13.2 Division of labor
| Layer | Owned by |
|---|---|
| Gate logic, state, stages, atomic writes | SDLC Validate |
| Compliance modules | SDLC Validate |
| Stack profiles | SDLC Validate |
| Internal pattern library (skills) | SDLC Validate |
| Production coding methodology | Superpowers |
| Browser-level verification | Playwright MCP |
| External library docs | Context7 |
| Aesthetic quality | Frontend Design |
| Accessibility compliance | Web Design Guidelines |

### 13.3 Install command pattern
```bash
npm install -g sdlc-validate
claude plugin install superpowers@claude-plugins-official
claude mcp add playwright -- npx -y @playwright/mcp@latest
claude mcp add context7 -- npx -y @upstash/context7-mcp@latest
claude plugin install frontend-design@claude-plugins-official

sdlc init --stack react-supabase-lambda \
          --compliance gdpr,wcag-2-1-aa \
          --requires superpowers,playwright,context7,frontend-design
```

---

## 14. Production Coding Flow (v1.1)

### 14.1 Task lifecycle
```
User: "Add a new posting-rule configuration screen"
    │
    sdlc-dispatcher (auto-trigger at session start)
    → reads state, recognizes coding task
    → routes to sdlc_task_init
    │
    sdlc_task_init creates:
    - Git worktree at .sdlc-worktrees/task-A/
    - Branch: sdlc/task-A-{timestamp}
    - Task plan: .sdlc-tasks/task-A.md
    │
    ▼
Per-task execution loop:
    ├── Read design source (Figma MCP OR design-spec.jsonc OR generate via Frontend Design)
    ├── Load skills (frontend-design, rabos-brand-system, web-design-guidelines, react-component)
    ├── Planner → task plan (Superpowers' writing-plans skill)
    ├── Plan-critic reviews → amendments if needed
    ├── For each task in plan:
    │     ├── Skills-fetcher injects relevant patterns
    │     ├── Writer generates code (own worktree)
    │     ├── Verifier (4-pass):
    │     │     1. tsc + lint
    │     │     2. /baseline-ui (Frontend Design's anti-slop)
    │     │     3. /fixing-accessibility (a11y)
    │     │     4. Playwright MCP (live UI test)
    │     ├── Two-stage review (Superpowers):
    │     │     1. Spec compliance against task description
    │     │     2. Code quality against standards
    │     ├── If errors: error-handler → re-write (max 2 retries)
    │     └── sdlc_task_checkpoint (atomic git commit on branch)
    │
    ▼
Push branch to origin
    │
CI takes over:
    ├── Full test suite
    ├── Type-check across whole project
    ├── Lint across whole project
    ├── Playwright E2E if frontend
    ├── sdlc audit --ci --incremental (incremental audit)
    ├── Spec compliance verifier
    └── Cross-task conflict check
    │
    ▼
PR opened with structured description from task plan
    │
Human review (CODEOWNERS or sdlc_governance/reviewers.yaml)
    │
    ▼
PR approved → merge to main
    │
post_merge hook:
    - Marks task COMPLETED in state
    - Updates affected stage's evidence hashes
    - If stage drift detected → flags for re-audit
    - Logs to event log
```

### 14.2 Why git worktrees
- Each writer is contained to its worktree — no merge at writer time
- Two writers in parallel never see each other's changes until merge
- CI is the merge gate — no path around it to main
- Worktree IS the lock; no separate file-level lock needed

### 14.3 Done-criteria per task type
Each task type has explicit done-criteria template:
- **feature task** — 12 checkboxes including docs, migration, feature flag, monitoring, i18n, accessibility, performance, security review, stakeholder sign-off
- **bugfix task** — 6 checkboxes
- **config change** — 3 checkboxes

Task is not closeable until every box checked or explicitly waived.

---

## 15. Framework Versioning and Upgrades

### 15.1 The five guarantees to clients
1. **PASSED stages remain PASSED across upgrades** (unless specific criterion changed; then targeted re-audit, not full re-run)
2. **Customizations to SDLC_VALIDATION.md survive** (region markers preserve user content)
3. **Custom skills, gates, compliance modules continue working** (plugin interface stability + codemods)
4. **Migrations reversible for 30 days** (`.sdlc-backups/` with `sdlc rollback`)
5. **Pin and skip** (v1.4 → v1.6 directly; no forced incremental chain)

### 15.2 Compatibility classification

| Change type | Version bump | Migration | Old PASSED affected? |
|---|---|---|---|
| New optional gate criterion | Patch | No | No |
| Existing gate criterion tightened | Minor | Optional | PASSED → flagged for re-audit |
| Existing gate criterion removed | Minor | Auto | No |
| Stage renumbered/restructured | Major | Mandatory | Preserved via mapping |
| New mandatory gate criterion | Major | Mandatory | PASSED → must re-audit |
| New stage added | Minor | Auto | New stage appears NOT STARTED |
| Stage removed | Major | Mandatory | Archived to history |
| Skill content updated | Patch on registry | No | Future work uses new skill |
| Skill removed/replaced | Minor | Auto-alias | Old skill ID resolves to new |
| Compliance module added | Patch/minor | Opt-in | Not loaded unless declared |

### 15.3 Region markers in SDLC_VALIDATION.md
```markdown
<!-- @sdlc:framework-region:start id="stage-4-checklist" -->
[Framework-managed content. Regenerated on upgrade.]
<!-- @sdlc:framework-region:end -->

<!-- @sdlc:user-region:start id="stage-4-highest-risk-modules" -->
- src/engine/posting.ts
- src/engine/tax.ts
- src/lib/auth.ts
<!-- @sdlc:user-region:end -->
```

Framework regions: regenerated on upgrade. User regions: untouched.

### 15.4 Migration flow (external client)
1. `sdlc upgrade --check` — pre-flight report
2. `sdlc upgrade --apply` — backs up, runs migration scripts in chain, verifies, regenerates docs preserving user regions
3. Interactive resolution of any unauthorized edits in framework regions
4. Print summary with next steps

### 15.5 Version policies
- **pinned** — never upgrade (audit/compliance freeze)
- **patch** — auto-apply patches (default for production)
- **minor** — auto-apply minor versions (default for active dev)
- **latest** — always upgrade (tooling teams)

### 15.6 LTS commitment
Every 4th minor version (v1.4, v1.8, v2.0) designated LTS with 24-month patch support.
Major version overlap: 12 months minimum.
Migration scripts: maintained forever.

---

## 16. Critical Open Questions

### 16.1 Audit framework (20 questions, prioritized)

**MVP-blocking (9):**
1. Framework versioning (state.json must record framework version)
2. Sub-agent disagreement contract (add `not_applicable`, `requires_human_judgment`)
3. CI mode (`--ci --format json`)
4. Per-stage reviewer / sign-off authority
5. Self-hosted audit (SDLC Validate auditing itself)
6. Session log privacy controls
7. Scope statement (what the framework does and doesn't guarantee)
8. License + governance + escape hatch (MIT, no rug pull)
9. HMAC integrity (covered above)

**v1.0.x post-launch (7):**
10. Partial / incremental audits (independent stage execution)
11. Monorepo support (per-package state, cross-package dependencies)
12. Language-agnostic stack profiles (Rust, Go, mobile, embedded)
13. Privacy / data residency (what's sent to Anthropic)
14. Cost predictability (per-project token budgets)
15. Framework upgrade path (covered above)
16. Non-code artifact verification (diagrams, ADRs, runbooks)

**v2.x / when problem appears (4):**
17. Skill freshness automation
18. Adversarial AI scenarios (prompt injection in repos)
19. Multi-machine state sync (git merge of state.json)
20. Telemetry policy

### 16.2 Production coding (25 questions, prioritized)

**MVP-blocking for v1.1 (10):**
1. Spec compliance verifier (catches wrong code that passes tests)
2. Checkpoint contract for writers
3. Scope discipline / sensitive_path_guard
4. Migration-writer dedicated agent type
5. Lock file for concurrent coding tasks
6. Session resumption from checkpoint
7. Per-task cost budget + auto-abort
8. Authentication/authorization sensitive-path guard
9. Post-commit workflow (PR, review, merge, deploy)
10. Explicit done-criteria templates per task type

**v1.1.x post-launch (8):**
11. Plan critic
12. Multi-file dependency graphs
13. Test writer separation (no tautological tests)
14. Library confidence checks
15. Whole-suite verification
16. Debug mode discipline
17. Plan amendment mechanism
18. Documentation drift detection

**v2.x / when problem appears (7):**
19. Refactor vs feature mode
20. Magical refactor problem
21. Test fixture PII scanning
22. Wrong abstraction problem
23. State placement guide
24. Skill version tracking across audit + coding
25. Framework self-repair

### 16.3 The single most underrated question
**#19 from audit — the "checkbox theatre" critique.** A project that passed every gate ships a P1 bug. Customer: "what's the point?" Honest answer: framework catches structural gaps, not behavioral bugs. Need:
- Clearly stated scope of what framework guarantees
- Post-incident analysis tooling: `sdlc post_incident` → traces to gates, proposes criteria updates
- Community feedback loop from incidents back to gate evolution

Without this, framework gets reputation as "checkbox theatre" within a year.

---

## 17. Comparison to Existing Plugins

### 17.1 The competitive landscape (2026)

| Plugin | Released | Focus | License |
|---|---|---|---|
| OCTALUME | Mar 2026 | US regulated industries (HIPAA, SOC 2, PCI, GDPR) | MIT |
| agentic-sdlc-plugin | Feb 2026 | Feature development, 10 slash commands, Playwright | Open |
| claude-code-skills (levnikolaevich) | 2026 | Multi-model AI review, 4-level gate | Open |
| AxonFlow | 2026 | Policy enforcement, PII scanning | Commercial |
| iamladi/sdlc | 2026 | Spec-driven development, constitutional alignment | Open |

### 17.2 What SDLC Validate does differently
- **Indian + global compliance focus** (GST, DPDP, RBI, plus GDPR/HIPAA/etc.) — none of others target this
- **Atomic-write state discipline** — most plugins let agents write logs directly
- **Explicit import/export dependency graph** — most plugins re-derive context per stage
- **Hook-based session log + policy enforcement** — combines AxonFlow's policy with disciplined logging
- **AI compliance first-class** (EU AI Act, NIST AI RMF, ISO 42001) — newest regulatory wave
- **Polyglot stack support** — not Python-only or JS-only
- **Region markers + LTS guarantees** — built for serious external adoption

### 17.3 Honest positioning
- NOT first to market
- IS competitive in design
- DIFFERENTIATES on compliance breadth + state discipline + adoption mechanics
- Treat as internal tooling primarily; open-source brings ecosystem benefits
- Don't compete with OCTALUME for US regulated industries; complement with global + AI compliance focus

---

## 18. Token Discipline (The Meta-Lesson)

### 18.1 What this conversation demonstrated
Over ~70 turns, ~120k tokens of conversation history accumulated. Every long architectural response (~5-8k tokens each) stayed in context. The pattern that should have been used:
- Each long response → disk file
- Conversation message → 200-token summary + file link
- New tasks → `/clear` and read summary file
- Persistent reference, ephemeral conversation

### 18.2 CLAUDE.md startup discipline
**The problem:** Old CLAUDE.md mandates a full read of SDLC_VALIDATION.md at session start (~15k tokens). Most sessions don't need it.

**The fix:** Replace with conditional surgical reads.

```markdown
## Session start protocol (revised)

At session start:
1. Read .sdlc-state.json → extract cursor, gate statuses
2. Read tail of .sdlc-events.log (last 5 lines) → recent activity
3. Read SDLC_VALIDATION.md lines containing "Quick Reference — Gate Status Summary" + 20 lines following → gate map only
4. Display cursor + last activity + flagged stages
5. DO NOT load full SDLC_VALIDATION.md
6. DO NOT preload skills

Use surgical reads thereafter:
- read_sdlc_section for stage content
- sdlc_skills_fetch for patterns
- get_session_context for state queries
- load_sdlc_context ONLY if explicitly requested
```

Startup cost: 19k → 3k. ~16k savings per session.

### 18.3 The discipline principle
"Pay once at startup" was the v0-era pattern. With surgical tools, "pay each piece exactly once across the project's lifetime, then read from state" is the v1-era pattern.

After Stage 4 passes, you've extracted everything that matters into findings frontmatter + history summary. Never re-read Stage 4's full section in future sessions unless re-auditing.

---

## 19. The Honest Implementation Status

> Updated 2026-05-20 after consolidation of session work + external commits.

### 19.1 What's actually built

**MCP tools — 20 live** (vs. 18 in the original design table):
- Setup & lifecycle: `init_project`, `sdlc_state_create`, `sdlc_init`, `sdlc_release_lock`
- Gate control: `check_gate_status`, `sdlc_agent_write`, `sdlc_gate_run`, `sdlc_gate_waive`, `sdlc_signoff`
- Docs & audit trail: `get_project_identity`, `load_sdlc_context`, `read_sdlc_section`, `log_decision`, `log_open_item`, `update_session_log`, `verify_artifact`
- Skills registry: `sdlc_skills_fetch`
- Production coding: `sdlc_task_checkpoint`, `sdlc_error_diagnose`
- Diagnostics: `sdlc_doctor`
- Dispatch: `sdlc_dispatch_agents`, `sdlc_dispatch_status` (from external commits)

**Sub-agents — 35 in `plugin/agents/`** (31 created in this session + 4 pre-existing from external commits): all 8 audit types (file-finder, config-reader, grep-checker, dep-scanner, secret-scanner, boundary-analyzer, pattern-consistency-checker, gate-synthesizer), 8 production-coding types (planner, skills-fetcher, writer, verifier, error-handler, test-writer, context-manager, doc-updater), 7 quality-enforcement types (spec-compliance-verifier, plan-critic, scope-guard, migration-writer, sensitive-path-guard, release-orchestrator, requirements-tracer), 4 integration types (docs-researcher, e2e-live-verifier, sdlc-dispatcher, design-drift-detector), 2 UI types (ui-aesthetic-enforcer, accessibility-auditor), 2 lifecycle types (migration-applier, upgrade-pre-flight).

**Skills — 116 in `plugin/skills/`**, organized by category:
- 7 flow-control commands (sdlc-init, sdlc-work, sdlc-status, sdlc-gate, sdlc-load, sdlc-dispatcher, sdlc-superpowers)
- 4 tooling integrations (sdlc-context7, sdlc-figma, sdlc-playwright, sdlc-frontend-design)
- 4 Tier 3 generic principles
- 9 security, 5 reliability, 3 observability, 5 API design, 3+3 testing
- 13 engineering practice
- 4+7+3+4 stack patterns (Postgres / AWS / LLM / React)
- 19 compliance (GDPR, HIPAA, EU AI Act, SOC 2, PCI DSS)
- 11 UI patterns

**Other infrastructure:**
- Hooks: `SessionStart` (2 mcp_tool calls), `Stop` (1 mcp_tool call)
- CLI binaries: `sdlc-audit`, `sdlc`, plus `sdlc-migrate` and `sdlc-tag` (from external commits)
- HMAC integrity layer + migration framework + region markers (per external commits — 1.0.0→1.1.0 migration script exists)
- marketplace.json wired with `commands` + `skills` + `agents` fields all pointing at file directories
- Stop hook UTF-8 fix; PostToolUse Co-Authored-By attribution hook in `.claude/settings.json`
- AI attribution rule documented in root CLAUDE.md

### 19.2 What's designed but not built

- ~~`sdlc_dispatch_wait`~~ — **resolved 2026-05-20 as redundant.** MCP tool calls are single request/response; a blocking wait would either hang until timeout or be a rename of `sdlc_dispatch_status`. Claude Code's Agent tool already emits completion notifications. Pattern documented in a comment block in `server.ts`.
- **Advanced quality MCP tools**: `sdlc_verify_history` (post-hoc HMAC re-check), `sdlc_admin_override` (auditable manual overrides), `sdlc_spec_compliance` (tool-level; currently exists as a sub-agent), `sdlc_design_drift` (tool-level; currently exists as a sub-agent)
- ~~**Compliance module loader**~~ — **shipped 2026-05-20.** `sdlc_skills_fetch` already read `.sdlc-stack.json#compliance`. Added `compliance.ts` (KNOWN_MODULES enum, prefix-based skill discovery) and `sdlc_compliance_status` MCP tool that returns: declared modules, active skills per module, out-of-scope skills, validation warnings for unknown modules. Plugin ships `.sdlc-stack.example.json` template documenting the schema.
- **Stack profile loader**: same mechanism handles `stack: "..."` in `.sdlc-stack.json` (already wired into `sdlc_skills_fetch`'s search-path resolution). The remaining gap is **auto-detection** — currently the user declares the stack manually. Auto-detection from `package.json` deps / dockerfile / etc. would be a follow-up.
- **Plugin integrations beyond skill-level**: skills exist for Context7, Figma, Playwright, Frontend Design, Superpowers — agents call into them as needed, but no deep workflow integration yet
- **L4 RABOS overlay** (10 skills): intentionally out of scope per the design — lives in RABOS repo, not the plugin

### 19.3 Ratio

**~85% built / ~15% designed.** Shipping framework — not a proof-of-concept anymore. The remaining gap is the production-coding mode polish (parallel-wait, compliance loader, stack-profile loader) and the advanced quality tools that have skill/agent equivalents but no MCP-tool surface.

The framework now self-supports: 116 skills cover the patterns; 35 agents cover the dispatch shapes; 20 MCP tools cover the state machinery. New projects can adopt by running `/sdlc-init` and proceed through all 10 stages with the gates enforced end-to-end.

---

## 20. Build Sequence (Recommended)

### 20.1 Now (continuing RABOS audit)
- Run stages 5-10 with current 4 MCP tools
- Configure 3-5 new audit agent instances per stage (same 8 types)
- ~40 sub-agent instances total by end of Stage 10
- Track token cost + wall-clock time per stage (observability data for tuning)

### 20.2 Next sprint (1-2 weeks)
- Build `sdlc_dispatch_agents`, `sdlc_dispatch_status`, `sdlc_dispatch_wait` (unlocks parallel + compact)
- Build `sdlc_skills_fetch` (unlocks production coding writers)
- Build `sdlc_task_checkpoint` (unlocks crash recovery mid-task)
- Add `framework_version` field to state.json and stamp existing test-practice state with "1.0.0"

### 20.3 Pre-launch hardening (~2 weeks)
- HMAC integrity layer (Defense 1+2+3)
- Region markers in SDLC_VALIDATION.md
- `sdlc init` CLI + governance bootstrap
- 4-level gate states + quality score
- CLI interface for non-interactive use
- Self-host: SDLC Validate auditing itself

### 20.4 Before external launch
- Migration framework (sdlc_migrate_check, sdlc_migrate_apply, sdlc_migrate_rollback)
- License + governance + escape hatch
- License + governance + escape hatch
- LTS designation
- CHANGELOG, MIGRATION, COMPATIBILITY docs
- 5 launch compliance modules
- Documentation: scope statement, what the framework guarantees and doesn't

### 20.5 v1.1 (production coding)
- All production coding agents (planner, writer, verifier, test-writer, etc.)
- All quality enforcement agents (spec-compliance, plan-critic, scope-guard, sensitive-path, migration-writer)
- Worktree + CI integration
- Done-criteria templates per task type
- Tier 2 skills written (~42 skills total)

### 20.6 v1.x post-launch
- Plugin integrations (Superpowers, Playwright, Context7, Figma, Frontend Design)
- Monorepo support
- Language-agnostic stack profiles
- Cost predictability
- Non-code artifact verification

### 20.7 v2.x
- UI design agents
- Self-improvement loop (`sdlc post_incident`)
- Cross-project pattern sharing
- Telemetry
- Community skill marketplace

---

## 21. The Decision This Document Forces

This document captures ~70 turns of design discussion. The next question is binary:

**Option A — Ship it as RABOS internal tooling only.**
- Build the remaining MCP tools + skills + agents over ~6 weeks
- RABOS becomes the reference implementation
- Use it on every RABOS module audit
- Don't open-source; treat as competitive advantage

**Option B — Ship it as open-source global framework.**
- Same build, plus migration framework + region markers + compliance modules + LTS
- Add ~3 weeks for adoption-grade hardening
- Total ~9-10 weeks to v1.0
- RABOS becomes the reference, framework becomes infrastructure
- Position as differentiator for RABOS Technologies (the company that built it)

**My recommendation:** Option B. The marginal cost (3 weeks) is small. The competitive moat is real (Indian-compliance focus + atomic state discipline). The brand value for RABOS Technologies is significant. And building for external clients forces discipline that makes the internal tool better too.

---

## 22. What This Document Is Not

- Not the implementation. The implementation lives in code (`server.ts`, `state.ts`, the four built MCP tools).
- Not a user manual. That's `SDLC_VALIDATION.md` plus future `MIGRATION.md`, `COMPATIBILITY.md`, `CHANGELOG.md`.
- Not exhaustive. ~30% of nuance from the conversation didn't fit. The full conversation transcript is the source of truth for any ambiguity.
- Not frozen. Designed to be edited as decisions evolve. Track changes in git.

---

## 23. Glossary

| Term | Definition |
|---|---|
| Audit mode | Read-only verification of codebase against gate criteria |
| Production coding mode | Gated writing of new code with same state discipline |
| Cursor | Current stage + status in state.json |
| Findings doc | Per-stage markdown with YAML frontmatter exports |
| Gate | The set of criteria a stage must meet to be PASSED |
| HMAC | Hash-based message authentication code; integrity layer for state |
| Memory namespace | Per-sub-agent key in state.json (ns) |
| Region marker | HTML comment delineating framework-managed vs user-managed content |
| Stage | One of the 10 sequential phases of the SDLC framework |
| Stack profile | Configuration declaring project's stack (React+Supabase+Lambda, etc.) |
| Compliance module | Pluggable set of additional gate criteria for a regulatory regime |
| Skill | A pattern/practice the writer agent reads before writing code |
| Sub-agent | A single-purpose agent (e.g., test-runner-checker, lint-verifier) |
| Gate synthesizer | The agent that combines sub-agent findings into a gate verdict |
| Verdict basis | Evidence (file hashes, command outputs) that produced a gate verdict |
| Evidence status | fresh / stale / invalid — whether verdict basis still matches disk |
| Worktree | Git's mechanism for multiple working trees from one repo |

---

## 24. References to the Conversation

This document was synthesized from a conversation covering (in order):
1. SDLC framework structure (10 stages + 2 cross-cutting)
2. Token efficiency principles
3. State file design and atomic writes
4. Findings frontmatter format
5. Gate synthesis algorithm
6. Section extraction (heading-based)
7. Implementation status (4 MCP tools, Stage 4 cleared)
8. Stop hook fix (71 stubs removed)
9. Model selection patterns (static vs router vs escalation)
10. Comparison to OCTALUME, agentic-sdlc, AxonFlow, others
11. Pulling features from competitors
12. Global vs India-only positioning
13. Complete skill inventory (106 skills)
14. Integration with Superpowers, Playwright MCP, Context7
15. UI design plugins (Frontend Design, Figma MCP, Web Design Guidelines)
16. Tamper-resistance (HMAC + drift detection + event log)
17. Critical open questions (20 audit + 25 production coding)
18. CLAUDE.md startup discipline
19. Framework upgrade strategy (region markers + LTS)
20. External client upgrade contract
21. Enterprise plugins (coding style, citations, traceability)
22. Async dispatch + compaction + parallel sub-agents
23. Git worktree + CI integration
24. Agent inventory consolidation
25. This document itself

---

## 25. Action Items From This Document

### Immediate (next session)
- [ ] Save this document to `g:\PROJECT\Learning Projects\sdlc-validate-design.md`
- [ ] Save the inventory tables separately to `sdlc-validate-inventory.md`
- [ ] Beef up `CLAUDE.md` with revised session-start protocol (Section 18.2 above)
- [ ] Add `framework_version: "1.0.0"` to existing test-practice state.json
- [ ] Then continue with Stage 5 audit

### Sprint 1 (1-2 weeks)
- [ ] Build async dispatch tools (sdlc_dispatch_agents, _status, _wait)
- [ ] Build sdlc_skills_fetch
- [ ] Build sdlc_task_checkpoint
- [ ] Write Tier 1 skills (bedrock-call, supabase-rls, lambda-worker, pii-handling, secret-handling)

### Sprint 2 (2 weeks)
- [ ] HMAC integrity layer
- [ ] Region markers in SDLC_VALIDATION.md
- [ ] CLI interface (`sdlc init`, `sdlc start N`, `sdlc gate N`, `sdlc status`)
- [ ] 4-level gate states (PASS/CONCERNS/FAIL/WAIVED)

### Pre-launch (decision point)
- [ ] Option A internal only OR Option B open-source global
- [ ] If B: migration framework, LTS commitment, license, compliance modules
- [ ] If B: domain + repo + first community contribution flow

---

*End of design document. Last updated 2026-05-20.*