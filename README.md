# SDLC Validation — Claude Code Plugin

Enforces a verified software delivery lifecycle on every project.
Install once, run `/sdlc-init` in any new project, and Claude guides you through all 10 stages with structured questions — no manual prompts, no copy-pasting.

---

## What it does

| Without the plugin | With the plugin |
|---|---|
| Claude invents architecture | Claude derives everything from your spec, logs every decision |
| Claude adds features you did not ask for | Forbidden from touching anything outside current gate scope |
| Claude guesses file paths and tech stack | Reads the repo, cites every value with `file:line` |
| Quality standards drift across sessions | Every session re-reads the same control document |
| No record of why decisions were made | Append-only Decision Log — every choice is reasoned and approved |
| Tests added as an afterthought | Test harness created before implementation, enforced by gate |
| You know what to type at each stage | Plugin asks you the right questions, one at a time |

---

## Install

**VS Code (Claude Code extension):**
1. Type `/plugins` in the Claude Code chat
2. Go to **Marketplaces** tab → Add: `https://github.com/razalrahmanp/imatter`
3. Go to **Plugins** tab → find `sdlc-validation` → click **Install**

**CLI (terminal):**
```
/plugin marketplace add https://github.com/razalrahmanp/imatter
/plugin install sdlc-validation@sdlc-tools
```

No configuration prompts. No manual setup.

---

## What happens on every session start

The plugin fires two MCP tools automatically via the `SessionStart` hook — before you type anything:

1. **`get_project_identity`** — reads Section 1 of your `SDLC_VALIDATION.md` and presents the project identity table
2. **`check_gate_status`** — shows which stages are `PASSED`, `IN PROGRESS`, or `NOT STARTED`

At session end, the `Stop` hook automatically calls **`update_session_log`** to write a session summary entry.

---

## Slash commands

Plugin commands are invoked by typing them as a chat message and sending. They do not appear in the autocomplete dropdown — just type and send.

### `/sdlc-init`
**Initialize a new project.** Copies the `SDLC_VALIDATION.md` template into the project root, then guides you through structured questions one at a time:

```
/sdlc-init

→ "What is the name of your project?"
   Your answer...

→ "In 2–4 sentences: what does it do and who uses it?"
   Your answer...

→ "List your user personas — one per line: role — what they do"
   Your answer...

→ "List must-have features for v1. One per line."
   Your answer...

→ "What is out of scope for v1, and why is each item deferred?"
   Your answer...

→ "Any performance or scale requirements?"
   Your answer...

→ "Preferred tech stack?"
   Your answer...

→ [Creates SDLC_VALIDATION.md + docs/spec.md + docs/roadmap.md]
→ Shows Stage 1 gate checklist with file:line evidence
→ "Say Stage 1 passed to continue"
```

Safe to re-run — never overwrites an existing `SDLC_VALIDATION.md`.

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

```
/sdlc-status
```

---

### `/sdlc-gate <N>`
**Check a specific gate.** If the gate is blocked, reads that stage's section and lists exactly what is missing before Claude can proceed.

```
/sdlc-gate 3
```

---

### `/sdlc-load`
**Load the full document.** Fetches the entire `SDLC_VALIDATION.md` into context. Use only when you need to reference multiple sections at once — for single-stage work, `/sdlc-work <N>` is more efficient.

```
/sdlc-load
```

---

## Context loading strategy

Loading the full SDLC file at startup would consume the context window before any work is done. Content is fetched in layers instead:

| When | What is loaded | How |
|---|---|---|
| Every session start | Project identity + gate table (~50 lines) | Automatic (`SessionStart` hook) |
| Working on Stage N | Stage N section only | `/sdlc-work N` calls `read_sdlc_section` |
| Full document needed | Entire `SDLC_VALIDATION.md` | `/sdlc-load` (explicit, on demand) |
| Session end | Session log entry written | Automatic (`Stop` hook) |

The Section 0 protocol rules (verification, gate discipline, scope discipline, decision discipline) are embedded in `CLAUDE.md` and loaded by Claude Code on every session — no file read required.

---

## MCP tools (called by Claude automatically)

All tools are pre-approved — they fire without prompting you.

| Tool | Purpose | Called by |
|---|---|---|
| `init_project` | Copy bundled template to project root — never overwrites | `/sdlc-init` |
| `get_project_identity` | Read Section 1 (project identity table) | `SessionStart`, `/sdlc-init` |
| `check_gate_status` | Return gate table; `isError: true` if gate not PASSED | `SessionStart`, all work skills |
| `read_sdlc_section` | Fetch one section by heading | `/sdlc-work`, `/sdlc-gate` |
| `load_sdlc_context` | Load full document | `/sdlc-load` |
| `log_decision` | Append a row to Section 15 (Decision Log) | Claude during Stage work |
| `log_open_item` | Append out-of-scope issue to Section 16 (Open Items) | Claude when scope drift detected |
| `update_session_log` | Append session summary to Section 18 (Session Log) | `Stop` hook |
| `verify_artifact` | Check file/dir exists, return `file:line` citation | `/sdlc-work`, gate checks |

---

## How to use

### Start a new project

1. Open the project folder in VS Code with Claude Code active
2. Send `/sdlc-init` — Claude asks questions one at a time and builds your spec
3. Say **Stage 1 passed** when the spec looks right
4. Send `/sdlc-work 2` to move to Architecture & Design
5. Repeat through all stages

### Continue an existing project

Open VS Code. The `SessionStart` hook automatically shows your gate table and where you left off. Send `/sdlc-work <N>` for the stage you want to continue.

### Advance a gate

When all criteria for a stage are met, say "Stage N passed." Claude verifies with `check_gate_status` and updates the gate status in `SDLC_VALIDATION.md`.

---

## Gate enforcement

When Claude is about to write code for a stage, it calls `check_gate_status` first. If the gate is not `PASSED`:

- The tool returns `isError: true`
- Claude stops and presents the gate status
- Claude calls `read_sdlc_section` to list what is missing
- Claude asks how you want to proceed

It does not write code. It does not work around the gate. It waits.

---

## Stages reference

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

## File structure

```
your-project/
├── SDLC_VALIDATION.md       ← the control document (one per project)
├── CLAUDE.md                ← coding standards (created in Stage 3)
├── CONTRIBUTING.md          ← branching model (created in Stage 5)
├── docs/
│   ├── spec.md              ← requirements with FR- IDs (Stage 1)
│   ├── roadmap.md           ← v1 scope and deferrals (Stage 1)
│   ├── architecture.md      ← component design (Stage 2)
│   └── decisions.md         ← ADR log (Stage 2, ongoing)
├── .github/workflows/
│   └── ci.yml               ← CI pipeline (Stage 5)
└── src/                     ← application code (Stage 6+)
```

---

## Plugin architecture

```
.claude-plugin/
└── marketplace.json         ← plugin manifest (hooks, mcpServers, permissions)

plugin/
├── dist/                    ← pre-built JS (committed — no build step at install)
│   ├── index.js             ← entry point (stdio or HTTP transport)
│   ├── server.js            ← MCP tools, resources, prompts
│   └── sdlc.js              ← file I/O: gate parsing, section reading, table append
├── skills/
│   ├── sdlc-init.md         ← /sdlc-init — guided project setup wizard
│   ├── sdlc-work.md         ← /sdlc-work <N> — guided stage workflow
│   ├── sdlc-status.md       ← /sdlc-status — gate status overview
│   ├── sdlc-gate.md         ← /sdlc-gate <N> — single gate check
│   └── sdlc-load.md         ← /sdlc-load — full document load
├── template/
│   └── SDLC_VALIDATION.md   ← bundled template (copied by /sdlc-init)
└── package.json             ← runtime deps only

sdlc-mcp-server/
└── src/                     ← TypeScript source (build → plugin/dist/)
```

The MCP server runs as a subprocess (`node plugin/dist/index.js`) using stdio transport. `${CLAUDE_PLUGIN_ROOT}` in `marketplace.json` is replaced with the plugin install path at runtime.

---

## Without the plugin (manual workflow)

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
