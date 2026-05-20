# SDLC Validation — Claude Code Plugin

Enforces a verified software delivery lifecycle on every project.
Install once, run `/sdlc-init` in any new project, and Claude guides you through all 10 stages with structured questions — no manual prompts, no copy-pasting.

---

## What It Does

| Without the plugin | With the plugin |
|---|---|
| Claude invents architecture | Claude derives everything from your spec, logs every decision |
| Claude adds features you did not ask for | Forbidden from touching anything outside current gate scope |
| Claude guesses file paths and tech stack | Reads the repo, cites every value with `file:line` |
| Quality standards drift across sessions | Every session re-reads the same control document |
| No record of why decisions were made | Append-only Decision Log — every choice is reasoned and approved |
| Tests added as an afterthought | Test harness created before implementation, enforced by gate |
| Context window fills with repeated background | Surgical section loading — only the active stage loads |
| No CI integration for gate compliance | `sdlc-audit` CLI with JSON output and exit codes for pipelines |

---

## How It Helps in the SDLC

The plugin enforces **gate discipline** — Claude cannot write implementation code for a stage unless that stage's gate is `PASSED`. This maps directly to real software delivery lifecycle phases:

```
Stage 1  Inception & Requirements   →  What are we building?
Stage 2  Architecture & Design      →  How are we building it?
Stage 3  Dev Environment & Standards→  What are the coding rules?
Stage 4  Test Harness               →  How do we prove it works?
Stage 5  CI/CD Pipeline             →  How does it reach production?
Stage 6  Deployment & Release       →  How do we deploy safely?
Stage 7  Observability & Operations →  How do we know it's healthy?
Stage 8  Security                   →  How do we protect user data?
Stage 9  Performance & Scale        →  How does it behave under load?
Stage 10 Data & Analytics           →  How do we measure outcomes?
```

Each stage requires specific artifacts before the gate passes. A gate cannot be marked `PASSED` unless every criterion has a `file:line` citation or explicit user confirmation. There is no way to skip silently — deferred criteria become tracked open items or formal waivers.

---

## Install

> **This is a Claude Code plugin, not an npm package.**
> `npm install -g sdlc-validation-plugin` will return a `404 Not Found` — nothing is published to the npm registry. Install it through the Claude Code marketplace as shown below.

**Prerequisite:** Claude Code itself.
```bash
npm install -g @anthropic-ai/claude-code
```

**VS Code (Claude Code extension):**
1. Type `/plugins` in the Claude Code chat
2. Go to **Marketplaces** tab → Add: `https://github.com/razalrahmanp/imatter`
3. Go to **Plugins** tab → find `sdlc-validation` → click **Install**

**Claude Code CLI (terminal):** start a session in any folder and run these as chat messages:
```
/plugin marketplace add https://github.com/razalrahmanp/imatter
/plugin install sdlc-validation@sdlc-tools
```

**Local development (hacking on this repo):**
```bash
git clone https://github.com/razalrahmanp/imatter.git
cd imatter
claude
# then inside the session:
/plugin marketplace add ./.claude-plugin/marketplace.json
/plugin install sdlc-validation@sdlc-tools
```

No configuration prompts. No manual setup.

---

## What Happens on Every Session Start

The plugin fires two MCP tools automatically via the `SessionStart` hook — before you type anything:

1. **`get_project_identity`** — reads Section 1 of your `SDLC_VALIDATION.md` and presents the project identity table
2. **`check_gate_status`** — shows which stages are `PASSED`, `IN PROGRESS`, or `NOT STARTED`

At session end, the `Stop` hook automatically calls **`update_session_log`** to write a session summary entry.

---

## Slash Commands

Plugin commands are invoked by typing them as a chat message and sending. They do not appear in the autocomplete dropdown — just type and send.

### `/sdlc-init`
**Initialize a new project.** Copies the `SDLC_VALIDATION.md` template into the project root, initializes `.sdlc-state.json` for machine-readable tracking, then guides you through structured questions one at a time:

```
/sdlc-init

→ "What is the name of your project?"
→ "In 2–4 sentences: what does it do and who uses it?"
→ "List your user personas — one per line: role — what they do"
→ "List must-have features for v1. One per line."
→ "What is out of scope for v1, and why is each item deferred?"
→ "Any performance or scale requirements?"
→ "Preferred tech stack?"

→ [Creates SDLC_VALIDATION.md + .sdlc-state.json + docs/spec.md + docs/roadmap.md]
→ Shows Stage 1 gate checklist with file:line evidence
→ "Say Stage 1 passed to continue"
```

Safe to re-run — never overwrites an existing `SDLC_VALIDATION.md` or `.sdlc-state.json`.

---

### `/sdlc-work <N>`
**Work through a specific stage.** Checks the prerequisite gate, reads the stage requirements, verifies existing artifacts, asks targeted questions one at a time, creates the required artifacts, then shows gate evidence.

```
/sdlc-work 2
```

**Stage-specific questions asked:**

| Stage | Questions asked |
|---|---|
| **1** — Inception & Requirements | Project name, description, personas, must-have features (FR- IDs), out-of-scope items, NFRs, tech stack |
| **2** — Architecture & Design | Tech stack confirmation, auth approach, multi-tenancy, external dependencies, deployment target, failure modes |
| **3** — Dev Practices | Linter/formatter, TypeScript strict mode, branching strategy, forbidden patterns |
| **4** — Testing Strategy | Coverage target %, test framework, highest-risk modules, real vs mocked DB for integration tests |
| **5** — Build & CI | CI provider, environments (dev/staging/prod), merge requirements, deployment steps |
| **6** — Deployment & Release | Deployment platform, rollback strategy, deploy type (blue-green/canary/rolling), feature flags |
| **7** — Observability | Logging platform, metrics/APM tool, critical alert thresholds, on-call rotation |
| **8** — Security | Auth provider, PII fields and protection, secrets management, compliance requirements |
| **9** — Performance & Scale | p95 latency targets per endpoint, peak concurrency, load testing tool, caching strategy |
| **10** — Data & Analytics | Analytics platform, tracked events, data retention policy, PII masking in analytics |

---

### `/sdlc-status`
**Show all gate statuses.** Presents the full gate table, flags every blocked stage, and lists the first missing artifact for each. Ends by asking what you want to work on.

---

### `/sdlc-gate <N>`
**Check a specific gate.** If the gate is blocked, reads that stage's section and lists exactly what is missing before Claude can proceed.

```
/sdlc-gate 3
```

---

### `/sdlc-load`
**Load the full document.** Fetches the entire `SDLC_VALIDATION.md` into context. Use only when you need to reference multiple sections at once — for single-stage work, `/sdlc-work <N>` is more efficient.

---

## Context Loading Strategy

This is the most important efficiency feature of the plugin. Loading the full SDLC document at session start would consume the context window before any work is done. Content is fetched in layers instead:

| When | What is loaded | How | Approx size |
|---|---|---|---|
| Every session start | Project identity + gate table | Automatic (`SessionStart` hook) | ~50 lines |
| Working on Stage N | Stage N section only | `/sdlc-work N` → `read_sdlc_section` | ~100–200 lines |
| Sub-agent findings | Stage cursor + compact history + SDLC section | `sdlc_init` fixed-budget payload | ~300–500 lines |
| Full document needed | Entire `SDLC_VALIDATION.md` | `/sdlc-load` (explicit, on demand) | ~1500+ lines |
| Session end | Session log entry written | Automatic (`Stop` hook) | 1 line |

The Section 0 protocol rules (verification, gate discipline, scope discipline, decision discipline) are embedded in `CLAUDE.md` and loaded by Claude Code on every session — no file read required.

### How `sdlc_init` Keeps Context Flat

`sdlc_init` replaces the need to re-read the full document every session. It assembles a single fixed-budget payload:

- **Cursor** — current stage + status + fail count
- **History summaries** — one-line per completed stage (not the full findings docs)
- **Named imports** — frontmatter values from prior-stage docs (not the full docs)
- **SDLC section** — only the active stage section
- **Stage config** — sub-agent namespaces and gate criteria

This means context stays roughly constant regardless of how many stages have completed.

---

## Gate Enforcement

When Claude is about to write code for a stage, it calls `check_gate_status` first. If the gate is not `PASSED`:

- The tool returns `isError: true`
- Claude stops and presents the gate status
- Claude calls `read_sdlc_section` to list what is missing
- Claude asks how you want to proceed

It does not write code. It does not work around the gate. It waits.

### Gate Lifecycle

```
NOT STARTED → IN PROGRESS → PASSED
                         ↘ PASSED_WITH_CONCERNS
                         ↘ FAILED (fail_count++)
                              ↘ FLAGGED (at 2 failures — human review required)
                         ↘ WAIVED (explicit user approval + documented reason)
                         ↘ HUMAN_JUDGMENT (ambiguous findings — escalated)
                         ↘ pending_signoff (reviewer role required before advance)
```

Gates use an HMAC-signed integrity chain — findings documents are hashed at gate time. Any post-hoc edit to evidence is detected by `sdlc_doctor`.

---

## Multi-Agent Gate Model

For stages that use sub-agents, the flow is:

```
sdlc_init          → acquire session lock, load stage context
  │
  ├── Agent A: sdlc_agent_write(ns="code-review", status="pass", artifacts=[...])
  ├── Agent B: sdlc_agent_write(ns="test-coverage", status="fail", artifacts=[...])
  └── ...
  │
sdlc_gate_run      → synthesize all findings → PASS / FAIL / HUMAN_JUDGMENT
  │
  ├── PASS: history entry written, cursor advances to next stage
  ├── FAIL: fail_count++; at 2 → flagged[], human review required
  └── HUMAN_JUDGMENT: cursor parks at awaiting_review, fail_count untouched
  │
sdlc_release_lock  → release .sdlc-state.lock
update_session_log → session summary appended
```

Each sub-agent writes to its own isolated namespace — no shared state between agents within a stage.

---

## Production Coding Support

### `sdlc_task_checkpoint`
For long file-writing tasks, flushes writer state after each iteration and returns a compact reload payload for the next. Prevents context blowout when a single file takes many iterations:

```
Iteration 1: write, checkpoint → get reload payload
Iteration 2: attach reload payload only (discard prior conversation), write, checkpoint
...
```

If a task blocks twice, it is automatically flagged for human review.

### `sdlc_error_diagnose`
Parses raw compiler/linter/test output into structured, token-efficient error payloads:

```
Raw tsc output (200 lines) → 3 structured errors with file:line citations and fix hints
```

Pass the structured payload to the writer agent — never the raw output. This prevents error traces from filling the context window.

---

## Skills Registry

`sdlc_skills_fetch` resolves implementation patterns through a layered registry:

```
compliance/<module>   ← highest priority (e.g. HIPAA, PCI)
project/<overlay>     ← project-specific overrides
stack/<profile>       ← stack-matched patterns (e.g. react-supabase-lambda)
practice/             ← general engineering practices
generic/              ← catch-all
flat/                 ← legacy flat files
```

Use `task_type='list'` to see all available skills, `task_type='lambda-handler'` to fetch a specific pattern. Only the `## Pattern Summary` section loads (~200 tokens) — not the full skill file.

---

## `sdlc-audit` CLI

A CI-mode audit runner that reads `.sdlc-state.json` directly — no MCP session required. Use it in pipelines to block merges when gate criteria are not met.

**Binaries:** `sdlc`, `sdlc-audit`

```bash
sdlc-audit [options]
```

| Flag | Description | Default |
|---|---|---|
| `--stages=1,4,8` | Audit only these stage numbers | All stages |
| `--fail-on=FAIL,CONCERNS` | Exit non-zero when these verdicts appear | `FAIL` only |
| `--format=json\|text` | Output format | `text` |
| `--project-root=/path` | Override project root | cwd or `SDLC_PROJECT_ROOT` env var |

**Exit codes:**

| Code | Meaning |
|---|---|
| `0` | All audited stages clean |
| `1` | CONCERNS found (only when `CONCERNS` is in `--fail-on`) |
| `2` | FAIL found, integrity check failed, or unrecoverable error |

**Examples:**

```bash
# Quick human-readable status
sdlc-audit

# CI gate — fail on concerns too
sdlc-audit --fail-on=FAIL,CONCERNS

# Check specific stages as JSON (for scripting / dashboards)
sdlc-audit --stages=1,2,3 --format=json

# Different project
sdlc-audit --project-root=/path/to/project
```

**JSON output shape:**
```json
{
  "framework_version": "1.2.0",
  "project_root": "/path/to/project",
  "audited_at": "2026-05-20T10:00:00.000Z",
  "results": [
    { "stage": 1, "name": "Inception & Requirements", "verdict": "PASSED", "score": 92 },
    { "stage": 2, "name": "Architecture & Design", "verdict": "PASSED_WITH_CONCERNS", "score": 78, "concerns": ["..."] }
  ],
  "summary": { "total": 10, "pass": 8, "concerns": 1, "fail": 0, "human_judgment": 0, "not_run": 1 }
}
```

---

## All MCP Tools

### Setup & Lifecycle

| Tool | Purpose | When to use |
|---|---|---|
| `init_project` | Copy bundled template to project root | Once per project — never overwrites |
| `sdlc_state_create` | Initialize `.sdlc-state.json`, generate HMAC key | Once per project, after `init_project` |
| `sdlc_init` | Load stage context, acquire session lock | Every session start or stage switch |
| `sdlc_release_lock` | Release `.sdlc-state.lock` | Every session end; also for stale lock recovery |

### Gate Control

| Tool | Purpose | When to use |
|---|---|---|
| `check_gate_status` | Return gate table; `isError: true` if blocked | Before any code work — called automatically |
| `sdlc_agent_write` | Record sub-agent findings into stage memory namespace | After each sub-agent completes |
| `sdlc_gate_run` | Synthesize findings → PASS / FAIL; advance cursor on pass | After all sub-agents have written |
| `sdlc_gate_waive` | Formally waive a gate criterion with documented reason | Only with explicit user approval |
| `sdlc_signoff` | Complete gate transition requiring reviewer role | When `cursor.status = pending_signoff` |

### Documentation & Audit Trail

| Tool | Purpose | When to use |
|---|---|---|
| `get_project_identity` | Read Section 1 (project name, repo, stack) | Session start |
| `load_sdlc_context` | Load full `SDLC_VALIDATION.md` | Full framework review only |
| `read_sdlc_section` | Fetch one section by heading | Stage work, gate checks |
| `log_decision` | Append to Section 15 (Decision Log) | Before acting on any significant decision |
| `log_open_item` | Append to Section 16 (Open Items) | Out-of-scope issues — never silently fixed |
| `update_session_log` | Append to Section 18 (Session Log) | Mandatory at every session end |
| `verify_artifact` | Check file/dir exists; return `file:line` citation | Gate evidence verification |

### Skills & Patterns

| Tool | Purpose | When to use |
|---|---|---|
| `sdlc_skills_fetch` | Fetch pattern summary from layered registry | Before implementing any pattern |

### Production Coding

| Tool | Purpose | When to use |
|---|---|---|
| `sdlc_task_checkpoint` | Flush writer state; return compact reload payload | After each writing iteration on long tasks |
| `sdlc_error_diagnose` | Parse compiler/linter/test output into structured errors | Before passing errors to writer agent |

### Diagnostics

| Tool | Purpose | When to use |
|---|---|---|
| `sdlc_doctor` | Check HMAC integrity, version match, evidence staleness, lock state | When something seems wrong |

---

## How to Use

### Start a New Project

1. Open the project folder in VS Code with Claude Code active
2. Send `/sdlc-init` — Claude asks questions one at a time and builds your spec
3. Say **Stage 1 passed** when the spec looks right
4. Send `/sdlc-work 2` to move to Architecture & Design
5. Repeat through all stages

### Continue an Existing Project

Open VS Code. The `SessionStart` hook automatically shows your gate table and where you left off. Send `/sdlc-work <N>` for the stage you want to continue.

### Advance a Gate

When all criteria for a stage are met, say "Stage N passed." Claude verifies with `check_gate_status` and updates the gate status in `SDLC_VALIDATION.md` and `.sdlc-state.json`.

### Diagnose Problems

```bash
# Something seems wrong with state
sdlc_doctor  # via MCP, or:
sdlc-audit --format=text

# Stale lock after a crashed session
# Delete .sdlc-state.lock, or call sdlc_release_lock
```

---

## Stages Reference

| Stage | Name | Artifacts created | Run when |
|---|---|---|---|
| 1 | Inception & Requirements | `docs/spec.md`, `docs/roadmap.md` | Project start |
| 2 | Architecture & Design | `docs/architecture.md`, `docs/decisions.md` | After Stage 1 |
| 3 | Dev Environment & Standards | `CLAUDE.md`, linter config, `tsconfig.json` | After Stage 2 |
| 4 | Test Harness | Test stubs, test runner config, coverage setup | After Stage 3 |
| 5 | CI/CD Pipeline | `.github/workflows/ci.yml`, `CONTRIBUTING.md` | After Stage 4 |
| 6 | Deployment & Release | Deploy config, runbook | After Stage 5 |
| 7 | Observability & Operations | Logging config, alert rules, runbook | Before staging deploy |
| 8 | Security | Auth config, secrets management, OWASP checklist | Before user data stored |
| 9 | Performance & Scale | Load test scripts, perf baselines | Before launch |
| 10 | Data & Analytics | Analytics schema, retention policy, PII masking rules | Before reporting features |

---

## File Structure

```
your-project/
├── SDLC_VALIDATION.md           ← human-readable gate definitions, decision log, session log
├── .sdlc-state.json             ← machine-readable state (cursor, history, sub-agent findings)
├── .sdlc-state.lock             ← session lock (auto-released; delete manually if stale)
├── .sdlc/
│   └── keys/state.key           ← HMAC signing key (auto-gitignored, never commit)
├── .sdlc-sessions/
│   └── s01-findings.md          ← per-stage findings documents (hashed at gate time)
├── .sdlc-tasks/
│   └── {task-id}.json           ← per-task iteration checkpoints for long writing tasks
├── .sdlc-stack.json             ← optional: stack profile + compliance layers for skills
├── CLAUDE.md                    ← coding standards (created in Stage 3)
├── CONTRIBUTING.md              ← branching model (created in Stage 5)
├── docs/
│   ├── spec.md                  ← requirements with FR- IDs (Stage 1)
│   ├── roadmap.md               ← v1 scope and deferrals (Stage 1)
│   ├── architecture.md          ← component design (Stage 2)
│   └── decisions.md             ← ADR log (Stage 2, ongoing)
├── .github/workflows/
│   └── ci.yml                   ← CI pipeline (Stage 5)
└── src/                         ← application code (Stage 6+)
```

---

## Plugin Architecture

```
.claude-plugin/
└── marketplace.json         ← plugin manifest (hooks, mcpServers, permissions)

plugin/
├── dist/                    ← pre-built JS (committed — no build step at install)
│   ├── index.js             ← entry point (stdio or HTTP transport)
│   ├── server.js            ← all MCP tools, resources, prompts
│   ├── sdlc.js              ← file I/O: gate parsing, section reading, table append
│   ├── state.js             ← .sdlc-state.json read/write, gate synthesis, task checkpoints
│   ├── integrity.js         ← HMAC signing, lock management, file hashing
│   └── cli.js               ← sdlc-audit CI runner
├── skills/
│   ├── sdlc-init.md         ← /sdlc-init guided project setup wizard
│   ├── sdlc-work.md         ← /sdlc-work <N> guided stage workflow
│   ├── sdlc-status.md       ← /sdlc-status gate status overview
│   ├── sdlc-gate.md         ← /sdlc-gate <N> single gate check
│   └── sdlc-load.md         ← /sdlc-load full document load
├── template/
│   └── SDLC_VALIDATION.md   ← bundled template (copied by /sdlc-init)
└── package.json

sdlc-mcp-server/
└── src/                     ← TypeScript source (build → plugin/dist/)
    ├── server.ts            ← MCP tool definitions
    ├── sdlc.ts              ← file I/O helpers
    ├── state.ts             ← state schema, gate synthesis logic
    ├── integrity.ts         ← HMAC, locks, file hashing
    └── cli.ts               ← sdlc-audit entry point
```

The MCP server runs as a subprocess (`node plugin/dist/index.js`) using stdio transport. `${CLAUDE_PLUGIN_ROOT}` in `marketplace.json` is replaced with the plugin install path at runtime.

---

## Without the Plugin (Manual Workflow)

If you are not using the Claude Code marketplace, copy `SDLC_VALIDATION.md` from this repo into your project root and start each session with:

```
Read SDLC_VALIDATION.md. Read Section 18 (Session Log) to understand where we left off.

Report:
- Current gate status (Quick Reference table at the bottom)
- What was in progress at the end of the last session
- What the next step is

Wait for my instruction before doing anything.
```

Then follow the gate progression: tell Claude which stage you are on, ask it to read that stage's gate section, and confirm each gate before moving forward.
