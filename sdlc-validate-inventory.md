# SDLC Validate — Design & Build Inventory

**Last updated:** 2026-05-20 (post build push)
**Repo:** `g:\PROJECT\Learning Projects` (github.com/razalrahmanp/imatter)
**Plugin version:** 1.4.0 (in repo; marketplace last published 1.2.0)

---

## Actual built state as of 2026-05-20

This snapshot reflects what currently lives in the repo, independent of the larger design below. Read this section first; the rest is the design vision against which to measure progress.

### What's built and shipping

| Surface | Count | Where | Notes |
|---|---|---|---|
| Skills | **61** | [`plugin/skills/`](plugin/skills/) | Registered as both `commands` and `skills` in `marketplace.json` |
| MCP servers | **1** | [`plugin/dist/index.js`](plugin/dist/index.js) | `sdlc-validation`, stdio transport |
| MCP tools | **20** | [`plugin/dist/server.js`](plugin/dist/server.js) | All on the single server |
| Hooks | **2** | [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) | `SessionStart` (2 tool calls), `Stop` (1 tool call) |
| Sub-agents | **0** | — | No `agents` field in marketplace.json |
| CLI binaries | **2** | [`plugin/dist/cli.js`](plugin/dist/cli.js) | `sdlc-audit` + `sdlc` aliases |

### Skills actually shipping (61)

| Category | Skill | Built in |
|---|---|---|
| Flow control (7) | `sdlc-init`, `sdlc-work`, `sdlc-status`, `sdlc-gate`, `sdlc-load`, `sdlc-dispatcher`, `sdlc-superpowers` | Pre-existing |
| Tooling integration (4) | `sdlc-context7`, `sdlc-figma`, `sdlc-playwright`, `sdlc-frontend-design` | Pre-existing |
| Generic principles / Tier 3 (4) | `sdlc-surgical-changes`, `sdlc-simplicity-first`, `sdlc-file-size-discipline`, `sdlc-match-existing-style` | 2026-05-20 |
| Security (9) | `sdlc-input-validation`, `sdlc-pii-handling`, `sdlc-secret-handling`, `sdlc-authn-pattern`, `sdlc-authz-pattern`, `sdlc-tenant-isolation`, `sdlc-owasp-top10-checklist`, `sdlc-audit-logging`, `sdlc-data-retention` | 2026-05-20 |
| Reliability (5) | `sdlc-error-handling`, `sdlc-retry-with-backoff`, `sdlc-circuit-breaker`, `sdlc-timeout-budgets`, `sdlc-graceful-degradation` | 2026-05-20 |
| Observability (3) | `sdlc-structured-logging`, `sdlc-distributed-tracing`, `sdlc-metrics-design` | 2026-05-20 |
| API design (4) | `sdlc-api-endpoint-design`, `sdlc-api-versioning`, `sdlc-rate-limiting`, `sdlc-webhook-receiver`, `sdlc-idempotency-keys` | 2026-05-20 |
| Testing (3) | `sdlc-unit-test-pattern`, `sdlc-integration-test-pattern`, `sdlc-mocking-strategy` | 2026-05-20 |
| Engineering practice (7) | `sdlc-commit-message-convention`, `sdlc-pr-description-template`, `sdlc-decision-record`, `sdlc-architecture-doc`, `sdlc-api-doc-pattern`, `sdlc-code-review-checklist`, `sdlc-runbook-pattern` | 2026-05-20 |
| Incident / context (2) | `sdlc-incident-response`, `sdlc-compaction-checkpoint` | 2026-05-20 |
| Traceability (1) | `sdlc-trace-requirements` | 2026-05-20 |
| Stack — AWS / cloud (4) | `sdlc-aws-websocket-handler`, `sdlc-aws-cognito-multi-pool`, `sdlc-lambda-worker`, `sdlc-supabase-rls` | 2026-05-20 |
| Stack — payments / messaging (4) | `sdlc-razorpay-webhook`, `sdlc-fcm-push`, `sdlc-sendgrid-email` (+ webhook-receiver already counted in API design) | 2026-05-20 |
| Stack — LLM (2) | `sdlc-bedrock-call`, `sdlc-prompt-injection-defense` | 2026-05-20 |
| UI accessibility / design system (2) | `sdlc-accessibility-wcag`, `sdlc-design-system-tokens` | 2026-05-20 |

### MCP tools actually shipping (20)

| Category | Tools |
|---|---|
| Setup & lifecycle (4) | `init_project`, `sdlc_state_create`, `sdlc_init`, `sdlc_release_lock` |
| Gate control (5) | `check_gate_status`, `sdlc_agent_write`, `sdlc_gate_run`, `sdlc_gate_waive`, `sdlc_signoff` |
| Docs & audit trail (7) | `get_project_identity`, `load_sdlc_context`, `read_sdlc_section`, `log_decision`, `log_open_item`, `update_session_log`, `verify_artifact` |
| Skills registry (1) | `sdlc_skills_fetch` |
| Production coding (2) | `sdlc_task_checkpoint`, `sdlc_error_diagnose` |
| Diagnostics (1) | `sdlc_doctor` |

### Naming reconciliation

The plugin uses an `sdlc-` prefix on all skills (so they don't collide with other plugins in the marketplace). The design tables below use bare names (`bedrock-call`, `supabase-rls`). When building a designed skill into the plugin, prefix it: `bedrock-call` → `sdlc-bedrock-call`.

The design's "MCP tool `sdlc_trace_requirements`" was built as the **skill** `sdlc-trace-requirements` instead — a markdown skill with the grep procedure is enough; no MCP tool was needed. Same applies to anything else where a skill can carry the procedure.

### Gap vs. design

- **Skills:** 21 built / 106 designed = **~20% built** (some built items are not in the designed inventory, since the designed inventory was RABOS-specific and the plugin shipping skills are framework-control + a starter set)
- **MCP tools:** 20 built / 18 designed in the table below = the plugin has *more* tools built than the design table catalogs (the plugin grew organically beyond the original design)
- **Sub-agents:** 0 built / 31 designed = **0% built**. This is the biggest gap. Plugin currently has no sub-agents at all.

---

# Design Vision (RABOS-driven inventory)

The remainder of this document is the original consolidated design produced during the RABOS conversation. Treat it as the larger roadmap — what *could* exist. The actual ship state above is what *does* exist.

---

## SKILLS

### Layer 1 — Generic skills (28 designed, 0 built)

Stack-agnostic, region-agnostic. Used by any project regardless of language.

| # | Skill | Status | Used by | When |
|---|---|---|---|---|
| 1 | api-endpoint-design | designed | writer agent | New endpoint creation |
| 2 | api-versioning | designed | writer agent | Versioning decisions |
| 3 | idempotency-keys | designed | writer agent | Mutation endpoints |
| 4 | rate-limiting | designed | writer agent | Public endpoints |
| 5 | webhook-receiver | designed | writer agent | Webhook handlers |
| 6 | input-validation | designed | writer agent + audit | Stage 8 gate + every entry point |
| 7 | pii-handling | designed | writer + sensitive-path-guard | Stage 8 audit + every PII touch |
| 8 | secret-handling | designed | writer + secret-scanner | Stage 8 audit + every secret reference |
| 9 | data-retention | designed | writer + audit | Storage decisions |
| 10 | audit-logging | designed | writer agent | Sensitive operations |
| 11 | error-handling | designed | writer agent | Every catch block |
| 12 | retry-with-backoff | designed | writer agent | External calls |
| 13 | circuit-breaker | designed | writer agent | Dependency failures |
| 14 | timeout-budgets | designed | writer agent | Request paths |
| 15 | graceful-degradation | designed | writer agent | Fallback patterns |
| 16 | structured-logging | designed | writer + audit | Stage 7 gate + every log call |
| 17 | distributed-tracing | designed | writer agent | Multi-service flows |
| 18 | metrics-design | designed | writer agent | New service instrumentation |
| 19 | slo-definition | designed | audit | Stage 9 gate |
| 20 | authn-pattern | designed | writer + sensitive-path-guard | Auth code (forced read) |
| 21 | authz-pattern | designed | writer + sensitive-path-guard | Authz code (forced read) |
| 22 | tenant-isolation | designed | writer + audit | Multi-tenant work |
| 23 | owasp-top10-checklist | designed | audit | Stage 8 gate |
| 24 | unit-test-pattern | designed | test-writer | New unit tests |
| 25 | integration-test-pattern | designed | test-writer | New integration tests |
| 26 | e2e-test-pattern | designed | test-writer + e2e-live-verifier | Critical journeys |
| 27 | test-fixture-design | designed | test-writer | Fixture creation |
| 28 | mocking-strategy | designed | test-writer | Mock decisions |

### Layer 2 — Tool/practice skills (14 designed, 0 built)

About engineering process itself. Language-agnostic.

| # | Skill | Status | Used by | When |
|---|---|---|---|---|
| 29 | code-review-checklist | designed | verifier | PR review pass |
| 30 | commit-message-convention | designed | writer + release-orchestrator | Every commit |
| 31 | pr-description-template | designed | release-orchestrator | PR creation |
| 32 | refactoring-safety | designed | writer agent | Refactor tasks |
| 33 | tech-debt-tracking | designed | scope-guard | Out-of-scope items |
| 34 | decision-record | designed | planner + writer | Significant decisions |
| 35 | incident-response | designed | (read by humans) | During incidents |
| 36 | postmortem-blameless | designed | (read by humans) | Post-incident |
| 37 | runbook-pattern | designed | writer + audit | Stage 7 gate |
| 38 | oncall-handoff | designed | (read by humans) | Handoff time |
| 39 | readme-structure | designed | doc-updater | README work |
| 40 | architecture-doc | designed | doc-updater + audit | Stage 2 gate |
| 41 | api-doc-pattern | designed | doc-updater + audit | Stage 5 gate |
| 42 | changelog-pattern | designed | doc-updater + release-orchestrator | Release prep |

### Layer 3 — Stack-specific (react-supabase-lambda) (22 designed, 0 built)

Patterns specific to RABOS's stack. Loaded only when stack profile = `react-supabase-lambda`.

| # | Skill | Status | Used by | When |
|---|---|---|---|---|
| 43 | supabase-rls | designed | writer + audit | Stage 3 + 8 gates, every new table |
| 44 | supabase-migration | designed | migration-writer | DDL changes |
| 45 | pgvector-pattern | designed | writer agent | Embedding work |
| 46 | postgres-partition | designed | writer agent | Large tables |
| 47 | materialized-view | designed | writer agent | Aggregation patterns |
| 48 | lambda-worker | designed | writer agent | New Lambda creation |
| 49 | sqs-trigger | designed | writer agent | Queue handlers |
| 50 | lambda-cold-start | designed | writer + audit | Stage 9 gate |
| 51 | eventbridge-pattern | designed | writer agent | Event-driven flows |
| 52 | step-function-pattern | designed | writer agent | Multi-step orchestration |
| 53 | bedrock-call | designed | writer + audit | Every LLM call (max_tokens enforcement) |
| 54 | bedrock-batch-inference | designed | writer agent | Non-interactive AI workloads |
| 55 | bedrock-tpm-management | designed | writer + audit | TPM quota planning |
| 56 | prompt-injection-defense | designed | writer agent | Any LLM input handler |
| 57 | agent-response-contract | designed | writer agent | Agent integration code |
| 58 | react-component | designed | writer agent | New components |
| 59 | react-data-fetching | designed | writer + audit | Stage 3 consistency gate |
| 60 | react-state-management | designed | writer agent | State decisions |
| 61 | react-error-boundary | designed | writer agent | Error boundaries |
| 62 | serverless-yml-pattern | designed | writer agent | IaC changes |
| 63 | cloudfront-cache | designed | writer agent | CDN config |
| 64 | cognito-jwt-validation | designed | writer + sensitive-path-guard | Auth code |

### Layer 4 — RABOS project overlay (10 designed, 0 built)

Specific to RABOS business logic. Lives outside the open-source repo.

| # | Skill | Status | Used by | When |
|---|---|---|---|---|
| 65 | insight-rule | designed | writer agent | Atlas insight creation |
| 66 | semantic-dsl | designed | writer agent | RIS Analyst work (no raw SQL) |
| 67 | connector-interface | designed | writer agent | Universal Connector usage |
| 68 | posting-rule | designed | writer agent | Accounting work |
| 69 | geocoding-pipeline | designed | writer agent | Atlas geocoding |
| 70 | coa-collision-check | designed | writer + audit | Every COA proposal |
| 71 | rabos-tenant-context | designed | writer agent | JWT shape, RLS injection |
| 72 | rabos-event-shape | designed | writer agent | Internal events |
| 73 | rabos-feature-flag | designed | writer agent | Feature flag logic |
| 74 | rabos-brand-system | designed | writer + ui-aesthetic-enforcer | All UI work |

### Layer 5 — Compliance skills (19 designed, 0 built)

Bundled with compliance modules. Loaded only when module is declared.

| # | Module | Skills | Status |
|---|---|---|---|
| 75-78 | GDPR | data-subject-rights, dpa-pattern, cross-border-transfer, consent-management | designed |
| 79-82 | EU AI Act | ai-risk-classification, ai-transparency-disclosure, ai-system-logging, ai-human-oversight | designed |
| 83-85 | SOC 2 | change-management-evidence, access-review-pattern, incident-evidence | designed |
| 86-89 | HIPAA | phi-handling, phi-access-logging, baa-pattern, breach-notification | designed |
| 90-93 | PCI DSS | card-data-tokenization, pan-truncation, pci-scope-reduction, pci-network-segmentation | designed |

### Layer 6 — UI-specific (12 designed, 0 built)

Added during the UI plugin discussion. Mix of generic and stack-specific.

| # | Skill | Status | Used by | When |
|---|---|---|---|---|
| 94 | design-spec-jsonc | designed | planner + writer | UI task start |
| 95 | accessibility-wcag | designed | accessibility-auditor | Stage 4/8 a11y gate |
| 96 | web-vitals | designed | audit | Stage 9 perf gate |
| 97 | bundle-budget | designed | audit | Stage 9 perf gate |
| 98 | motion-preference | designed | writer agent | Motion code |
| 99 | design-system-tokens | designed | writer + audit | Stage 2/3 design system gate |
| 100 | design-drift-audit | designed | design-drift-detector | Periodic check |
| 101 | visual-regression-pattern | designed | test-writer | Snapshot tests |
| 102 | react-design-tokens | designed | writer agent | RABOS stack UI |
| 103 | react-aria-pattern | designed | writer agent | Accessible primitives |
| 104 | react-motion-library | designed | writer agent | Animation code |
| 105 | rabos-component-library | designed | writer agent | Component usage |

### Layer 7 — Compaction / context discipline (1 designed, 0 built)

| # | Skill | Status | Used by | When |
|---|---|---|---|---|
| 106 | compaction-checkpoint | designed | context-manager agent | When token budget approaches threshold |

---

## SKILLS SUMMARY

| Layer | Count | Status |
|---|---|---|
| L1 Generic | 28 | designed |
| L2 Tool/practice | 14 | designed |
| L3 Stack (react-supabase-lambda) | 22 | designed |
| L4 RABOS overlay | 10 | designed |
| L5 Compliance (5 modules) | 19 | designed |
| L6 UI-specific | 12 | designed |
| L7 Compaction | 1 | designed |
| **Total** | **106** | **all designed, 0 written** |

**Build priority (RABOS first):**
- Tier 1 (write before stage 5 audit ends): bedrock-call, supabase-rls, lambda-worker, pii-handling, secret-handling (~5 skills)
- Tier 2 (write before production coding): all of L1 + L2 (~42 skills total including Tier 1)
- Tier 3 (write before global launch): L3 stack-specific (22) + 3 launch compliance modules
- Tier 4 (community contribution): everything else

---

## MCP TOOLS

### Already built (4)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 1 | sdlc_state_create | Bootstraps `.sdlc-state.json` from Quick Reference | Once, at project init |
| 2 | sdlc_init | Assembles fixed-budget session context (cursor + summaries + named imports + SDLC section) | Every Claude session start |
| 3 | sdlc_agent_write | Namespace-isolated sub-agent finding writer; atomic | Every sub-agent on completion |
| 4 | sdlc_gate_run | Synthesizes gate verdict; advances cursor on PASS; fail-counts and flags on repeat FAIL | After all sub-agents in a stage finish |

### Designed for production coding (3)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 5 | sdlc_skills_fetch | Reads `skills/{task_type}.md`, returns first `##` section only (~200 tokens) | Writer agent before any code write |
| 6 | sdlc_task_checkpoint | Flushes writer state to `task-plan.json`; returns compact context for next iteration | After each verifier round in a writer loop |
| 7 | sdlc_error_diagnose | Classifies verifier error output (type/lint/test/runtime); returns structured payload with exact lines | When verifier fails; before retry |

### Designed for parallel + compact (3)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 8 | sdlc_dispatch_agents | Spawns sub-agents async; returns `dispatch_id` immediately | Stage start: dispatch all checks in parallel |
| 9 | sdlc_dispatch_status | Returns current status of dispatch (running/complete/failed) | Polling for completion |
| 10 | sdlc_dispatch_wait | Blocks until all sub-agents complete (with timeout) | When orchestrator needs sync before gate |

### Designed for state integrity (added during HMAC discussion)

| # | Tool | What it does | When to use |
|---|---|---|---|
| 11 | sdlc_verify_history | Re-checks verdict_basis hashes against current disk; marks stale evidence | `sdlc_init` calls this; also on-demand |
| 12 | sdlc_admin_override | Logged manual override of state with reason (audit trail) | When genuine override needed |

### Designed for client upgrades

| # | Tool | What it does | When to use |
|---|---|---|---|
| 13 | sdlc_migrate_check | Pre-flight check showing what an upgrade would change | Before applying any upgrade |
| 14 | sdlc_migrate_apply | Runs migration scripts in sequence; preserves user regions; backs up first | Applying a framework version upgrade |
| 15 | sdlc_migrate_rollback | Restores from `.sdlc-backups/` within 30-day window | When an upgrade needs reverting |

### Designed for traceability / quality

| # | Tool | What it does | When to use |
|---|---|---|---|
| 16 | sdlc_trace_requirements | Maps FR-x.y.z requirements in spec docs to tests; surfaces untested requirements | Stage 4 audit gate criterion |
| 17 | sdlc_spec_compliance | Compares produced code against task description and design spec | After writer completes, before commit |
| 18 | sdlc_design_drift | Compares production UI against Figma source via Figma MCP; surfaces diffs | Weekly drift check on UI tier |

---

## MCP TOOLS SUMMARY

| Status | Count | Tools |
|---|---|---|
| Built | 4 | sdlc_state_create, sdlc_init, sdlc_agent_write, sdlc_gate_run |
| Designed (production coding) | 3 | sdlc_skills_fetch, sdlc_task_checkpoint, sdlc_error_diagnose |
| Designed (parallel + compact) | 3 | sdlc_dispatch_agents, sdlc_dispatch_status, sdlc_dispatch_wait |
| Designed (state integrity) | 2 | sdlc_verify_history, sdlc_admin_override |
| Designed (client upgrades) | 3 | sdlc_migrate_check, sdlc_migrate_apply, sdlc_migrate_rollback |
| Designed (traceability/quality) | 3 | sdlc_trace_requirements, sdlc_spec_compliance, sdlc_design_drift |
| **Total** | **18** | **4 built, 14 designed** |

> **Reconciliation note (2026-05-20):** The actual plugin in this repo already ships **20** MCP tools — the original design table only catalogs 18. The implementation went beyond the design. Notably built but not in this table: `init_project`, `check_gate_status`, `get_project_identity`, `read_sdlc_section`, `log_decision`, `log_open_item`, `update_session_log`, `verify_artifact`, `load_sdlc_context`, `sdlc_release_lock`, `sdlc_gate_waive`, `sdlc_signoff`, `sdlc_doctor`. Several "designed" tools are still missing: dispatch trio (#8/9/10), migration trio (#13/14/15), and spec/drift pair (#17/18).

**Build order:**
- Now: keep using the built tools for stages 5–10 audit
- Before production coding: build 5, 6, 7 (skills, checkpoint, error diagnose) + 8, 9, 10 (dispatch)
- Before public v1.0: build 11, 12 (state integrity)
- Before public v1.0: build 13, 14, 15 (upgrades) — non-negotiable for external adoption
- Highest-leverage quality additions: 16, 17, 18

---

## AGENTS

### Built and used (4 instances of 4 types)

| # | Agent | Type | Used in |
|---|---|---|---|
| 1 | test-runner-checker | grep-checker (Haiku) | Stage 4 audit |
| 2 | test-files-checker | grep-checker (Haiku) | Stage 4 audit |
| 3 | coverage-checker | config-reader (Haiku) | Stage 4 audit |
| 4 | ci-gate-checker | boundary-analyzer (Sonnet) | Stage 4 audit |

> **Reconciliation note (2026-05-20):** These agents existed in the RABOS test-practice fixture, which was deleted in commit `43b1a7c`. **The SDLC plugin itself currently ships 0 sub-agents** (no `agents` field in `marketplace.json`). The "Built" status above refers to instances in the now-deleted fixture, not the shipping plugin.

### Designed audit agent types (8 types, reused across all 10 stages)

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

### Designed production coding agents (8 types)

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

### Designed quality enforcement agents (7 types)

| # | Agent | Model | Role |
|---|---|---|---|
| 17 | spec-compliance-verifier | Sonnet | Code matches task description? |
| 18 | plan-critic | Sonnet | Reviews plan before any writer runs |
| 19 | scope-guard | Haiku | Blocks out-of-scope diffs |
| 20 | migration-writer | Sonnet | DDL changes only (special discipline) |
| 21 | sensitive-path-guard | Sonnet | auth/migrations/.env paths |
| 22 | release-orchestrator | Sonnet | Post-commit (PR, deploy, monitoring) |
| 23 | requirements-tracer | Sonnet | FR-x.y.z to test mapping |

### Designed integration agents (4 types)

| # | Agent | Model | Role |
|---|---|---|---|
| 24 | docs-researcher | Sonnet | Calls Context7 for current library docs |
| 25 | e2e-live-verifier | Sonnet | Uses Playwright MCP for live UI test |
| 26 | sdlc-dispatcher | Sonnet | Auto-trigger at session start |
| 27 | design-drift-detector | Sonnet | Production UI vs Figma source |

### Designed UI agents (2 types — others rolled up)

| # | Agent | Model | Role |
|---|---|---|---|
| 28 | ui-aesthetic-enforcer | Sonnet | Strips AI-generic patterns (Frontend Design's /baseline-ui) |
| 29 | accessibility-auditor | Sonnet | WCAG 2.1 AA verification |

### Designed lifecycle agents (2 types)

| # | Agent | Model | Role |
|---|---|---|---|
| 30 | migration-applier | Sonnet | Runs framework version migrations |
| 31 | upgrade-pre-flight | Sonnet | Pre-flight check before framework upgrade |

---

## AGENTS SUMMARY

| Category | Types | Status |
|---|---|---|
| Audit | 8 | 4 instances built in deleted fixture; 0 in shipping plugin; 4 more types designed |
| Production coding | 8 | designed |
| Quality enforcement | 7 | designed |
| Integration | 4 | designed |
| UI | 2 | designed |
| Lifecycle | 2 | designed |
| **Total types** | **31** | **0 in shipping plugin; 27 types designed** |

**Model distribution:**
- Haiku: 8 types (cheap, read-only checks)
- Sonnet: 22 types (analysis, reasoning, synthesis)
- Opus: 1 (gate-synthesizer, only on confirmed disagreement)

---

## What's in `state.json` vs what's in code vs what's in skills

Quick reference:

| Lives in code | Lives in state.json | Lives in skills files |
|---|---|---|
| MCP tool implementations | Cursor position, history, memory | Pattern summaries |
| Hook scripts | Sub-agent assignments per stage | Anti-pattern warnings |
| Migration scripts | Gate criteria per stage | When-to-use guidance |
| Schema validation | HMAC signatures + chain | Code examples |
| Agent dispatch logic | Lock metadata | Related skills cross-references |
| Compaction logic | Evidence basis hashes |  |

---

## The honest implementation status

**As of 2026-05-20 (this repo):**

What's actually built:
- 20 MCP tools in the shipping plugin
- 21 skills in the shipping plugin
- 2 hooks (`SessionStart`, `Stop`)
- 1 MCP server
- 2 CLI binaries (`sdlc-audit`, `sdlc`)
- Working state.json schema, gate parsing, integrity (HMAC), task checkpoints, error diagnosis
- Plugin published to local marketplace at version 1.4.0 (in-repo); last marketplace publish was 1.2.0

What's *designed but not built*:
- 0 sub-agents in the shipping plugin (the design specifies 31 types)
- Region markers in SDLC_VALIDATION.md
- Migration framework (`sdlc_migrate_*` trio)
- Dispatch trio (`sdlc_dispatch_*`)
- State-integrity verification tool (`sdlc_verify_history`)
- Most of the 106 designed skills (only ~20 generic/stack/practice skills exist in the plugin)
- All deep integrations beyond Context7 + Figma + Playwright + Frontend Design + Superpowers (which are skill-level, not tool-level)

**Ratio (honest reading):**
- MCP tools: 20 built / ~32 total designed = ~63%
- Skills: ~21 plugin skills / 106 designed = ~20%
- Agents: 0 shipping / 31 designed = 0%
- Overall surface area: roughly 30–40% built

The original RABOS-driven inventory said "5% built." That number was from a different lens (counting only RABOS-targeted artifacts, not the framework plumbing). From the framework-plumbing lens, the plugin is closer to a third built.

---

## Roadmap notes

**Save status updates here as work proceeds.** Each row in the design tables above can carry a tracking field:

```
status: designed | implementing | built | tested | deployed
```

Update this file every time a designed item flips state. The point of this document is to be the durable map across sessions — when the conversation auto-compacts, this file is what the next session reads first.

### Suggested next-session protocol

1. Read this file (`sdlc-validate-inventory.md`) first.
2. Read [`SDLC_VALIDATION.md`](SDLC_VALIDATION.md) Section 18 (Session Log) for the last session's notes.
3. Read [`.sdlc-state.json`](.sdlc-state.json) — current cursor + gate history.
4. Then decide what to work on.

---

**End of inventory. Update this file as items ship.**
