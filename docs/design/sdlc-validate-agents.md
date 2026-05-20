# SDLC Validate — Agent Inventory

> **Build status (2026-05-20):** All 31 agent types in this document are now implemented as markdown files in `plugin/agents/`, with `marketplace.json` registering the directory via `agents: ["./agents/"]`. Each file has YAML frontmatter (`name`, `description`, `tools`, `model`) and a process / input / output specification. The 4 originally-built Stage-4-only instances (test-runner-checker, test-files-checker, coverage-checker, ci-gate-checker) remain as project-data examples in `.sdlc-state.json` schemas, not as separate files.

## Audit Agents (8) — reused across all 10 stages

| ID | Agent | Model | Reused in stages | Purpose |
|---|---|---|---|---|
| A1 | file-finder | Haiku | 1, 2, 6, 7, 8 | Verifies required files exist at expected paths |
| A2 | config-reader | Haiku | 3, 5, 7 | Reads config files, checks required fields/values |
| A3 | grep-checker | Haiku | 1, 3, 4, 5, 6, 8, 9 | Pattern-searches codebase for presence/absence of constructs |
| A4 | dep-scanner | Haiku | 3, 5, 8 | Reads package manifests, checks dependency versions |
| A5 | secret-scanner | Haiku | 6, 8 | Scans for hardcoded secrets, credentials, env var leaks |
| A6 | boundary-analyzer | Sonnet | 2, 3, 8 | Reads module structure, checks import boundaries and layering |
| A7 | pattern-consistency-checker | Sonnet | 3, 9, 10 | Checks repeated patterns are consistent across the codebase |
| A8 | gate-synthesizer | Sonnet (Opus on conflict) | every stage | Aggregates sub-agent findings into a single gate verdict |

**MCP tools required:** `sdlc_agent_write`, `verify_artifact`, `check_gate_status`

---

## Production Coding Agents (8)

| ID | Agent | Model | Role |
|---|---|---|---|
| C1 | planner | Sonnet | Decomposes task → task-plan.json; identifies files to change |
| C2 | skills-fetcher | Haiku | Calls `sdlc_skills_fetch`; injects relevant pattern into writer context |
| C3 | writer | Sonnet | One instance per file being changed; receives plan + pattern |
| C4 | verifier | Haiku → Sonnet | Runs tsc/lint/test on changes; escalates to Sonnet on failure |
| C5 | error-handler | Sonnet | Diagnoses structured errors from verifier; routes fix back to writer |
| C6 | test-writer | Sonnet | Writes tests for new code; runs after writer, before verifier |
| C7 | context-manager | Sonnet | Monitors token budget; triggers compact before overflow |
| C8 | doc-updater | Haiku | Updates SDLC doc sections when scope or decisions change |

**MCP tools required:** `sdlc_skills_fetch`, `sdlc_task_checkpoint`, `sdlc_error_diagnose`, `get_session_context`

---

## Quality Enforcement Agents (7)

| ID | Agent | Model | Role | When it runs |
|---|---|---|---|---|
| Q1 | spec-compliance-verifier | Sonnet | Compares written code against original task description; catches passing tests that don't solve the right problem | After verifier passes |
| Q2 | plan-critic | Sonnet | Reviews task-plan.json before any writer runs; sends back to planner if scope or approach is wrong | After planner, before writer |
| Q3 | scope-guard | Haiku | Diffs proposed changes against declared scope; blocks out-of-scope edits | Runtime, every diff |
| Q4 | migration-writer | Sonnet | Writes schema migrations only; general writers never touch DDL | When schema change needed |
| Q5 | sensitive-path-guard | Sonnet | Pattern-matches sensitive paths (auth/, migrations/, .env); enforces special review | Runtime hook |
| Q6 | requirements-tracer | Sonnet | Maps FR-x.y.z requirements to tests; surfaces untested requirements | Stage 4 audit + after test-writer |
| Q7 | ui-aesthetic-enforcer | Sonnet | Runs baseline-ui pattern; strips AI-generic UI patterns | UI coding tasks only |

**MCP tools required:** `read_sdlc_section`, `log_open_item`, `verify_artifact`

---

## Integration Agents (4)

| ID | Agent | Model | Role | When it runs |
|---|---|---|---|---|
| I1 | docs-researcher | Sonnet | Calls Context7 for current library docs; runs in isolated context to avoid polluting main | Before writer, when library API needed |
| I2 | e2e-live-verifier | Sonnet | Uses Playwright MCP to run UI against live app | After deploy, Stage 9 |
| I3 | sdlc-dispatcher | Sonnet | Reads state at session start; presents cursor position and next-step options | Session start hook |
| I4 | accessibility-auditor | Sonnet | WCAG 2.1 AA verification via Playwright accessibility tree | UI coding tasks, Stage 9 |

**MCP tools required:** `get_session_context`, `read_sdlc_section`, Playwright MCP, Context7 MCP

---

## Lifecycle Agents (4)

| ID | Agent | Model | Role | When it runs |
|---|---|---|---|---|
| L1 | release-orchestrator | Sonnet | Handles post-commit workflow: PR description, reviewer assignment, deploy verification | After Stage 6 gate passes |
| L2 | migration-applier | Sonnet | Runs framework migration scripts in sequence; preserves user SDLC_VALIDATION.md regions | `sdlc migrate --apply` |
| L3 | upgrade-pre-flight | Sonnet | Pre-flight check before framework upgrade; explains impact on PASSED stages | Before `sdlc migrate` |
| L4 | design-drift-detector | Sonnet | Compares production UI against Figma source; surfaces diffs | Scheduled / Stage 9 |

**MCP tools required:** `update_session_log`, `log_decision`, `read_sdlc_section`

---

## Totals

| Category | Count | Primary model |
|---|---|---|
| Audit | 8 | Haiku/Sonnet |
| Production coding | 8 | Sonnet |
| Quality enforcement | 7 | Sonnet |
| Integration | 4 | Sonnet |
| Lifecycle | 4 | Sonnet |
| **Total** | **31** | |

**By model:** ~8 Haiku · ~22 Sonnet · Opus only for gate-synthesizer conflict arbitration (rare)

---

## Implementation status

| Category | Built | Designed only |
|---|---|---|
| Audit | A8 (gate-synthesizer logic in MCP) + A1-A7 patterns defined | instances configured per-stage |
| Production coding | C2 (`sdlc_skills_fetch`), C7/C8 partial | C1, C3-C6 not yet built |
| Quality enforcement | Q3 (scope-guard as hook concept) | Q1, Q2, Q4-Q7 not built |
| Integration | I3 (sdlc-dispatcher concept) | I1, I2, I4 not built |
| Lifecycle | L2/L3 design in `sdlc-migrate` design | none built |

**Infrastructure gaps before production coding sprint:**
- `sdlc_dispatch_agents` + `sdlc_dispatch_status` — async parallel dispatch
- `sdlc_task_checkpoint` — crash recovery mid-task
- `sdlc_error_diagnose` — structured error routing

---

## Known merge candidates

- **Q7 ui-aesthetic-enforcer** is a configured instance of **A7 pattern-consistency-checker** with `domain: ui` — not a separate agent type. Reduces true distinct types to 30.
- **A6 boundary-analyzer** (audit-time, reads structure) vs **Q3 scope-guard** (runtime, diffs changes) — distinct enough to keep separate.
