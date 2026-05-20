# SDLC Validate — Consolidated Design Reference
<!-- Updated: 2026-05-20. Source: sessions up to and including this one. -->

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

### Sprint plan summary (93 unique skills target)

| Layer | Count | Status |
|---|---|---|
| Generic (patterns) | 21 | Done |
| Practice (tool/process) | 14 | Done |
| Stack: react-supabase-lambda | 12 | Done |
| Compliance: GDPR | 3 | Done |
| Compliance: EU AI Act | 4 | Done |
| Compliance: SOC 2 | 3 | Done |
| Compliance: HIPAA | 4 | Done |
| Compliance: PCI DSS | 4 | Done |
| Compliance: WCAG 2.1 AA | 1 | Done |
| Compliance: EAA | 1 | Done |
| Compliance: ADA Title III | 1 | Done |
| **Total** | **68** | **~Done** |
| Project: RABOS | 12 | Pending |
| Additional generic/stack | ~13 | Pending |

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
| `sdlc_stage_configure` | (planned) Set stage config: sub_agents, gate criteria, imports |

### Planned future tools
| Tool | Priority |
|---|---|
| `sdlc_task_init` | Coding: create worktree, branch, task plan |
| `sdlc_pr_describe` | Coding: generate PR description from task plan + diff |
| `sdlc_post_merge` | Coding: update state + mark evidence stale on merge |
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
| 9 | Framework upgrade path / migrations | Pending v1.x |
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

### v1.1.x (next: coding layer MVP)
Address coding pre-launch items 1, 2, 4, 6, 9, 11, 12, 15, 20, 23 minimum.
Architecture: git worktree per task + CI as merge gate + sdlc_post_merge hook.
Key new tools: sdlc_task_init, sdlc_pr_describe, sdlc_post_merge.
Key new agents: spec_compliance_verifier, plan_critic, migration_writer.

### v1.2 (audit post-launch)
- Partial / incremental audits (#3)
- Non-code artifact verification (#12)
- Framework upgrade path (#9)
- Cost predictability (#8)

### v2.x
- Monorepo support (#4)
- Multi-machine state sync (#16)
- Adversarial AI defense (#14)
- Skill freshness automation (#11)
- Framework self-repair (#25)

---

## 9. Key Files

| Path | Purpose |
|---|---|
| `sdlc-mcp-server/src/integrity.ts` | HMAC chain, lock file |
| `sdlc-mcp-server/src/state.ts` | All types, gate synthesis, state I/O |
| `sdlc-mcp-server/src/sdlc.ts` | SDLC file parsing, QR regen |
| `sdlc-mcp-server/src/server.ts` | All MCP tool handlers |
| `sdlc-mcp-server/src/cli.ts` | CI mode CLI binary |
| `practices/test-practice/skills/` | Skill registry root |
| `practices/test-practice/scripts/validate-skills.js` | Skill frontmatter validator |
| `practices/test-practice/scripts/generate-registry.js` | Registry index generator |
| `practices/test-practice/skills/registry.json` | Machine-readable index (100 skills) |
| `SDLC_VALIDATION.md` | Active project SDLC gate document |
| `.sdlc-state.json` | Live gate state (HMAC-signed, do not edit) |
| `.sdlc/keys/state.key` | HMAC key (gitignored, machine-local) |
| `.sdlc-state.lock` | Session lock (gitignored) |
