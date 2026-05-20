# SDLC Validate — Consolidated Design Reference
<!-- Updated: 2026-05-20 (session 4 — major build sweep). Source: all sessions to date. -->
<!-- Implementation status: ~85% built. 20 MCP tools live, 35 sub-agents shipped, 116 skills shipped. See sdlc-design.md Section 19 for full accounting. -->

---

## 1. Architecture

### Core concept
SDLC Validate is an MCP server that enforces a 10-stage software development lifecycle gate framework. It is NOT an AI agent orchestrator — it is a gate authority. AI agents write findings; the MCP server synthesizes verdicts.

### Layer hierarchy (skill registry)
Resolution order (highest priority first):
1. `compliance/{module}/` — active compliance modules (GDPR, WCAG, EU-AI-Act, SOC2, HIPAA, PCI-DSS, EAA, ADA, accessibility-wcag)
2. `project/{project-id}/` — project-specific overrides (e.g. RABOS)
3. `stack/{stack-id}/` — stack profile (e.g. react-supabase-lambda)
4. `practice/` — tool/process skills (TDD, PR conventions, runbooks, etc.)
5. `generic/` — language-agnostic patterns
6. `{flat}/` — legacy flat files, no frontmatter, skipped by validator

### Skill frontmatter schema (required fields)
```yaml
id: kebab-case-slug
title: "Human-readable title"
layer: generic | practice | stack | project | compliance
stack: react-supabase-lambda        # required if layer=stack
project: rabos                       # required if layer=project
compliance_module: gdpr              # required if layer=compliance
tags: [tag1, tag2, tag3]             # 2–10 tags
applies_to:
  task_types: [add-endpoint, audit]  # from VALID_TASK_TYPES set
  stages: [1, 4, 8]                  # integers 1–20 or "all"
size_tokens: 200                     # 50–600 expected range
related: [other-skill-id]            # optional
```

### Skill file structure
Every skill has exactly two sections:
- `## Pattern Summary` — ~200 tokens, injected into AI context by `sdlc_skills_fetch`
- `## Full Reference` — human-only, never injected

### Stack config (`.sdlc-stack.json` in project root)
```json
{
  "stack": "react-supabase-lambda",
  "project_overlay": "rabos",
  "compliance": ["gdpr", "wcag-2-1-aa", "accessibility-us"]
}
```

---

## 2. Skill Inventory

### Actual skill count: 116 files in `plugin/skills/` (verified 2026-05-20)

| Layer | Count | Status |
|---|---|---|
| Generic (patterns) | 21 | Done |
| Practice (tool/process) | 14 | Done |
| Stack: react-supabase-lambda | 12 | Done |
| Compliance: GDPR | ~5 | Done (more than original 3 — consent mgmt, cross-border, DPA added) |
| Compliance: EU AI Act | 4 | Done |
| Compliance: SOC 2 | 3 | Done |
| Compliance: HIPAA | ~5 | Done (PHI handling + PHI access logging added) |
| Compliance: PCI DSS | 4 | Done |
| Compliance: WCAG 2.1 AA | 1 | Done |
| Compliance: EAA | 1 | Done |
| Compliance: ADA Title III | 1 | Done |
| AWS infra / React patterns | ~25 | Done (Bedrock, SQS, Lambda, CloudFront, Cognito, etc.) |
| Agent / SDLC process | ~10 | Done (agent-response-contract, agent-dispatch, etc.) |
| **Total** | **116** | **Done** |
| Project: RABOS | 12 | Pending |

### VALID_TASK_TYPES (from validate-skills.js)
Full set is in `practices/test-practice/scripts/validate-skills.js`. Key categories: HTTP/Lambda, Workers/queues, Database, Frontend, AI/LLM, Integrations, Features/flags, Events, Admin/monitoring/ops, Compliance/audit, Process/review, RABOS-specific, plus `any`/`all`.

### Registry tooling
- `npm run skills:validate` — validate all skill frontmatter (exit 1 on errors)
- `npm run skills:index` — regenerate `skills/registry.json`
- `npm run skills:check` — validate + check registry is up to date
- Both scripts are CJS (no `"type": "module"`) — required because ts-jest

---

## 3. MCP Tool Surface

### State path: `.sdlc-state.json`
Schema version: `sdlc-state/1.1`. Framework version: tracked in `sdlc_framework_version` field.

### State key interfaces (state.ts)
```typescript
AgentFinding.status: "pass" | "fail" | "acknowledged" | "not_applicable"
AgentFinding.requires_human_judgment?: boolean

GateResult.verdict: "PASS" | "CONCERNS" | "FAIL" | "BLOCKED" | "WAIVED" | "HUMAN_JUDGMENT"

Cursor.status: "in_progress" | "gate_failed" | "awaiting_review" | "pending_signoff"
Cursor.pending_signoff?: { gate_verdict, gate_score, required_roles, requested_at }

HistoryEntry.verified_with_framework_version?: string  // stamped on every new gate pass
SdlcState.sdlc_framework_version: string  (FRAMEWORK_VERSION = "1.1.0")
SdlcState.pending_review?: PendingReview   (set when reviewer signoff required)
SdlcState._signature?: Signature           (HMAC chain — never edit manually)
```

### Full tool list (as of 2026-05-20)

| Tool | Purpose |
|---|---|
| `load_sdlc_context` | Load SDLC_VALIDATION.md into context (SessionStart hook) |
| `check_gate_status` | Check stage gate PASSED/NOT STARTED/IN PROGRESS |
| `get_project_identity` | Read Section 1 from SDLC file |
| `read_sdlc_section` | Read any section by heading |
| `log_decision` | Append to Section 15 (Decision Log) |
| `log_open_item` | Append to Section 16 (Open Items) |
| `update_session_log` | Append to Section 18 (Session Log) — now has `log_level` |
| `verify_artifact` | Check if artifact file exists, return file:line citation |
| `init_project` | Copy SDLC template into new project |
| `sdlc_skills_fetch` | Fetch skill Pattern Summary by id (multi-layer resolution) |
| `sdlc_state_create` | Init .sdlc-state.json + generate HMAC key + update .gitignore |
| `sdlc_init` | Acquire lock, verify integrity, load stage context, regen QR |
| `sdlc_agent_write` | Record sub-agent findings to stage memory namespace |
| `sdlc_gate_run` | Synthesize verdict; handle HUMAN_JUDGMENT/reviewer/doc_sha256/QR regen |
| `sdlc_gate_waive` | Record explicit waiver, advance cursor |
| `sdlc_release_lock` | Release .sdlc-state.lock |
| `sdlc_signoff` | Complete pending_signoff gate transition (human reviewer confirmation) |
| `sdlc_doctor` | Diagnose: integrity, version, evidence staleness, lock, cursor |
| `sdlc_task_checkpoint` | Flush writer iteration state to .sdlc-tasks/{id}.json |
| `sdlc_error_diagnose` | Classify raw compiler/linter/test output into structured DiagnosedError[] |
| `sdlc_dispatch_agents` | Create dispatch record for stage sub-agents; returns parallel run checklist |
| `sdlc_dispatch_status` | Check pending/reported counts; signals when gate is ready to run |

### MCP resources (on-demand, correct pattern — do NOT load at session start)

| Resource URI | Returns |
|---|---|
| `sdlc://validation` | Full `SDLC_VALIDATION.md` as `text/markdown` |
| `sdlc://gates` | Gate status summary table as `text/plain` |

### MCP prompts

| Prompt | Purpose |
|---|---|
| `sdlc_protocol` | Section 0 protocol rules — inject into system prompt to activate gate enforcement |
| `sdlc_session_start` | Session start message with cursor state + last session log |

### Planned audit tools (v1.1.x–v1.2)
| Tool | Priority | Why |
|---|---|---|
| `sdlc_verify_history` | High | Defense 2: detect state drift between history and actual codebase |
| `sdlc_trace_requirements` | High | Map FR-x.y.z requirements to test coverage — differentiator nobody else has |
| `sdlc_spec_compliance` | High | Catches code that passes tests but solves the wrong problem |
| `sdlc_dispatch_wait` | Low | Likely already covered by polling `sdlc_dispatch_status` |
| `sdlc_design_drift` | Low | UI/Figma drift detection — defer to v2.x |

### Planned coding tools (v1.2)
| Tool | Priority |
|---|---|
| `sdlc_task_init` | Coding: create worktree, branch, task plan |
| `sdlc_pr_describe` | Coding: generate PR description from task plan + diff |
| `sdlc_post_merge` | Coding: update state + mark evidence stale on merge |
| `sdlc_stage_configure` | Set stage config: sub_agents, gate criteria, imports |
| `sdlc_audit --incremental` | CI: only re-verify stages with stale evidence |

---

## 4. Integrity Architecture (Defense 1–3)

### Defense 1: HMAC chain (integrity.ts)
- Key: `.sdlc/keys/state.key` (32-byte random hex, mode 0o600, gitignored)
- Per history entry HMAC: covers stage, name, gate, cleared_at, summary, doc, doc_sha256, score
- Per cursor HMAC: covers stage, status, fail_count, started_at
- Top-level HMAC: covers entire state minus `_signature` itself
- Findings doc hash: SHA-256 of `sNN-findings.md` at gate time → `doc_sha256` in history entry
- `readState()` calls `verifyState()` and throws on tampering
- `writeState()` calls `signState()` before serializing

### Defense 2: Lock file
- Path: `.sdlc-state.lock` (gitignored)
- Contains: `{ session_id, started_at, pid, host }`
- Stale detection: PID dead OR age > 6 hours → take over
- `sdlc_init` acquires lock; `sdlc_release_lock` releases it

### Defense 3: QR table regeneration
- `regenerateQuickReference(state, sdlcPath)` in sdlc.ts
- Called by: `sdlc_init`, `sdlc_gate_run` (PASS path), `sdlc_gate_waive`, `sdlc_signoff`
- Rewrites status/date columns from history + cursor
- Leaves ONGOING rows untouched
- Manual edits to QR table are overwritten next session

---

## 5. Gate System

### 4-level verdict hierarchy
`WAIVED > BLOCKED > FAIL > CONCERNS > PASS` (HUMAN_JUDGMENT is a separate escalation)

### AgentFinding status semantics
- `pass` — criterion met
- `fail` — criterion not met (may be blocking or concern-severity)
- `acknowledged` — issue known, accepted (half-weight in scoring)
- `not_applicable` — criterion doesn't apply to this project (excluded from scoring)
- `requires_human_judgment: true` — gate cannot decide; escalates without consuming fail_count

### Quality score
- Blocking criteria: weight 3; concern-severity: weight 1; not_applicable: excluded
- Score formula: `(earnedWeight / totalWeight) × 100`
- Pass threshold: 80/100

### Reviewer signoff flow
1. `StageConfig.gate.reviewer` set → gate result parked in `state.pending_review`
2. `cursor.status = "pending_signoff"`
3. `sdlc_signoff(approved_by)` → writes history entry, advances cursor, clears pending_review

---

## 6. CI Mode (cli.ts)

### Binary: `sdlc` or `sdlc-audit` (dist/cli.js)

```bash
sdlc-audit \
  --stages=4,8 \
  --fail-on=FAIL,CONCERNS \
  --format=json \
  --project-root=/path/to/project
```

### Exit codes
- `0` — all audited stages clean
- `1` — CONCERNS found (only when CONCERNS in --fail-on)
- `2` — FAIL found, or integrity failure

### GitHub Actions integration
```yaml
- name: SDLC Audit
  run: |
    npx sdlc-audit \
      --stages=${{ env.AFFECTED_STAGES }} \
      --fail-on=FAIL \
      --format=json \
      --output=audit-results.json
```

---

## 7. Open Critical Questions

### Pre-launch AUDIT (must address before external use)
| # | Question | Status |
|---|---|---|
| 1 | Framework versioning in state.json | **Done (v1.1.0)** |
| 2 | Sub-agent disagreement (not_applicable, HJ) | **Done** |
| 3 | Partial / incremental audits | Pending v1.x |
| 4 | Monorepo support | Pending v1.x |
| 5 | CI mode (--ci --format json) | **Done** |
| 6 | Language-agnostic stack profiles | Pending v1.x |
| 7 | Privacy / data residency for API calls | Pending v1.x |
| 8 | Cost predictability per project | Pending v1.x |
| 9 | Framework upgrade path / migrations | **Done** — `sdlc-migrate` + `sdlc-tag` CLIs shipped; 1.0.0→1.1.0 migration script exists; backup/rollback working |
| 10 | Per-stage reviewer / sign-off authority | **Done** |
| 11 | Skill freshness over time | Pending v2.x |
| 12 | Non-code artifact verification | Pending v1.x |
| 13 | Framework audits itself (meta-audit) | Policy decision |
| 14 | Adversarial AI / prompt injection | Pending v2.x |
| 15 | Session log privacy controls | **Done (log_level)** |
| 16 | Multi-machine state sync / merge driver | Pending v2.x |
| 17 | Stale skill problem at scale | Pending v2.x |
| 18 | Telemetry opt-in policy | Policy decision |
| 19 | Scope statement (what framework guarantees) | Docs needed |
| 20 | License + governance + escape hatch | MIT, policy decision |

### Pre-launch CODING (must address before coding mode ships)
| # | Question | Status |
|---|---|---|
| 1 | Spec compliance verifier agent | Pending |
| 2 | Checkpoint contract (what sdlc_task_checkpoint persists) | Pending |
| 3 | Plan critic agent | Pending |
| 4 | Scope discipline / sensitive_path_guard | Pending |
| 5 | Multi-file dependency graphs | Pending |
| 6 | Migration-writer dedicated agent type | Pending |
| 7 | Test writer separation (TDD-enforced) | Pending |
| 8 | Refactor vs feature task mode | Pending v1.x |
| 9 | Per-file lock for concurrent coding | Pending (worktree solves this) |
| 10 | Library confidence checks | Pending |
| 11 | Session resumption from checkpoint | Partial (checkpoint tool exists) |
| 12 | Per-task cost budget + auto-abort | Pending |
| 13 | Whole-suite verification (not just changed files) | Pending |
| 14 | Debug mode discipline | Pending |
| 15 | Auth/authz sensitive-path guard | Pending |
| 16 | Magical refactor problem | Pending v1.x |
| 17 | Plan amendment mechanism | Pending |
| 18 | Test fixture PII scanning | Pending v1.x |
| 19 | Documentation drift detection | Pending |
| 20 | Post-commit workflow (PR/review/merge/deploy) | Pending |
| 21 | Wrong abstraction prevention | Pending v2.x |
| 22 | State management decision guide | Pending |
| 23 | Explicit done-criteria per task type | Pending |
| 24 | Skill version tracking across audit+coding | Pending v1.x |
| 25 | Framework self-repair / bootstrap | Pending v2.x |

---

## 8. Build Sequence

### v1.0 (shipped)
- Multi-layer skill registry (compliance/project/stack/practice/generic)
- 68 skills across all layers
- validate-skills.js + generate-registry.js CI scripts
- HMAC integrity chain (Defense 1)
- Lock file (Defense 2)
- QR table regeneration (Defense 3)
- Full MCP tool surface (19 tools)

### v1.1 (shipped this session)
- FRAMEWORK_VERSION = "1.1.0" in state
- not_applicable + requires_human_judgment + HUMAN_JUDGMENT verdict
- CI mode CLI (sdlc / sdlc-audit binary)
- Per-stage reviewer signoff (sdlc_signoff tool)
- sdlc_doctor diagnostic tool
- Session log privacy (log_level: minimal/normal/verbose)
- `sdlc_task_checkpoint` + `sdlc_error_diagnose` MCP tools
- `regions.ts` — full region parser/serializer (framework/user/user-override/placeholder)
- `template-generator.ts` — section map for all SDLC stages
- `HistoryEntry.verified_with_framework_version` stamped on every gate pass
- CLAUDE.md startup protocol: replaced full doc load (~19k tokens) with surgical reads (~3.5k tokens)
  - Session start: read `.sdlc-state.json` + `read_sdlc_section('18. Session Log')` only
  - Knowledge access rules: section-first reflex, never pre-load speculatively

### v1.1.x (SHIPPED — plan at docs/superpowers/plans/2026-05-20-sdlc-infrastructure-build.md)
- `sdlc_dispatch_agents` + `sdlc_dispatch_status` MCP tools
- `sdlc-tag` CLI — apply region markers to SDLC_VALIDATION.md
- `sdlc-migrate` CLI — migration runner with backup/rollback + `migration.ts` runner module
- First migration script: `src/migrations/1.0.0-to-1.1.0.ts`
- Root `.sdlc-state.json` stage configs for all 10 stages
- Integration skills verified (all 116 clean against known MCP tool names)
- MCP resources: `sdlc://validation` + `sdlc://gates`; prompts: `sdlc_protocol` + `sdlc_session_start`
- Hooks: SessionStart (project identity + gate status) + Stop (session log)
- 116 skills shipped vs design's 93 target

### Overall completion estimate (2026-05-20): ~45%

| Layer | Built | Remaining |
|---|---|---|
| State + integrity | ✓ | — |
| MCP tool surface | 22/22 core + 5 planned (verify_history, trace_requirements, spec_compliance, + 2) | — |
| CLI binaries | 5/5 | migration chain test |
| Region markers + migration | ✓ | migration chain test needed |
| Skills library | 116 (design: 93) | RABOS project overlay (12) |
| Agent configs in state | 10 stages configured | — |
| Production coding layer | 0% | v1.2 sprint |
| External integrations | Skills exist (Playwright, Context7, Figma) | Runtime wiring |

### v1.2 (next sprint — audit completion + coding layer MVP)
- Coding layer MVP: address pre-launch items 1, 2, 4, 6, 9, 11, 12, 15, 20, 23
- Architecture: git worktree per task + CI as merge gate + sdlc_post_merge hook
- Key new tools: sdlc_task_init, sdlc_pr_describe, sdlc_post_merge
- Key new agents: spec_compliance_verifier, plan_critic, migration_writer

### v1.3 (audit post-launch)
- Partial / incremental audits (#3)
- Non-code artifact verification (#12)
- Cost predictability (#8)

### v2.x
- Monorepo support (#4)
- Multi-machine state sync (#16)
- Adversarial AI defense (#14)
- Skill freshness automation (#11)
- Framework self-repair (#25)

---

## 9. Agent Inventory

Full detail in `sdlc-validate-inventory.md`. Summary:

| Category | Count | Model | When |
|---|---|---|---|
| Audit (A1–A8) | 8 | Haiku + Sonnet | Every stage gate |
| Production coding (C1–C8) | 8 | Sonnet | Every coding task |
| Quality enforcement (Q1–Q7) | 7 | Sonnet | Runtime guards |
| Integration (I1–I4) | 4 | Sonnet | Context7, Playwright, dispatcher, accessibility |
| Lifecycle (L1–L4) | 4 | Sonnet | Release, migration, upgrade |
| **Total** | **31** | | |

**Model ratio:** ~8 Haiku · ~22 Sonnet · Opus only for gate-synthesizer conflict arbitration.

**Key design principle:** 25 of 31 agents are verifiers, not creators. Orchestration lives in the state machine; agents do one thing each.

**Architecture clarification (2026-05-20):** Agents are **project-defined data, not framework-shipped artifacts.** Each project's `.sdlc-state.json` defines its own sub-agent configurations per stage (agent IDs, namespaces, check descriptions, model assignments). The framework provides the dispatcher (`sdlc_dispatch_agents` + `sdlc_dispatch_status`) and the namespace pattern — projects fill in the specifics. The 31 agent types in this table are recommended configurations, not framework code.

**Implementation status:** Gate synthesis logic built in MCP (`sdlc_agent_write` + `sdlc_gate_run`). All 10 stages configured with sub-agent specs in root `.sdlc-state.json`. Production coding agents (C1–C8) and quality enforcement agents (Q1–Q7) not yet wired — pending v1.2 coding layer. Infrastructure for dispatch (parallel run + status tracking) shipped.

---

## 10. Key Files

| Path | Purpose |
|---|---|
| `sdlc-mcp-server/src/integrity.ts` | HMAC chain, lock file |
| `sdlc-mcp-server/src/state.ts` | All types, gate synthesis, state I/O |
| `sdlc-mcp-server/src/sdlc.ts` | SDLC file parsing, QR regen |
| `sdlc-mcp-server/src/server.ts` | All MCP tool handlers |
| `sdlc-mcp-server/src/cli.ts` | CI mode CLI binary (`sdlc-audit`) |
| `sdlc-mcp-server/src/regions.ts` | Region parser/serializer for SDLC_VALIDATION.md |
| `sdlc-mcp-server/src/template-generator.ts` | Section map (SECTION_MAP) for all stages |
| `sdlc-mcp-server/src/dispatch.ts` | Dispatch record types + `.sdlc-dispatch/` I/O |
| `sdlc-mcp-server/src/tag.ts` | `sdlc-tag` CLI — apply region markers to SDLC_VALIDATION.md |
| `sdlc-mcp-server/src/migrate.ts` | `sdlc-migrate` CLI — check/apply/rollback/list-backups |
| `sdlc-mcp-server/src/migration.ts` | Migration runner + helpers (replaceFrameworkRegion, insertRegionAfter) |
| `sdlc-mcp-server/src/migrations/1.0.0-to-1.1.0.ts` | First migration: insert SDLC:version marker |
| `plugin/skills/sdlc-*.md` | Integration skills (dispatcher, superpowers, playwright, context7, figma, frontend-design) |
| `sdlc-validate-inventory.md` | Agent inventory — 31 types, 5 categories, implementation status |
| `sdlc-validate-design.md` | This document — consolidated design reference |
| `docs/superpowers/plans/2026-05-20-sdlc-infrastructure-build.md` | v1.1.x build plan |
| `SDLC_VALIDATION.md` | Active project SDLC gate document |
| `.sdlc-state.json` | Live gate state (HMAC-signed, do not edit) |
| `.sdlc/keys/state.key` | HMAC key (gitignored, machine-local) |
| `.sdlc-state.lock` | Session lock (gitignored) |
