# SDLC Validation — Claude Code Plugin

Enforces a verified software delivery lifecycle on every project.
Drop `SDLC_VALIDATION.md` into any workspace, install the plugin once, and Claude automatically loads project context, checks gate status, and blocks implementation until gates are PASSED — every session, without any manual prompts.

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

---

## Install

```
/plugin marketplace add https://github.com/razalrahmanp/imatter
/plugin install sdlc-validation@sdlc-tools
```

That is all. No configuration prompts. No manual setup.

---

## What happens on every session start

The plugin fires two MCP tools automatically via the `SessionStart` hook — before you type anything:

1. **`get_project_identity`** — reads Section 1 of your `SDLC_VALIDATION.md` and presents the project identity table (name, owner, tech stack, repo, etc.)
2. **`check_gate_status`** — reads the Quick Reference table and shows which stages are `PASSED`, `IN PROGRESS`, or `NOT STARTED`

This injects ~50 lines of focused context — just the project header and gate table. Nothing else is loaded automatically. Stage sections and gate criteria are fetched on demand only when you start working on a specific stage.

---

## Context loading strategy

Loading the full SDLC file at startup would consume the context window before any work is done. Instead, content is fetched in layers:

| When | What is loaded | How |
|---|---|---|
| Every session start | Project identity + gate table | Automatic (`SessionStart` hook) |
| Working on Stage N | Stage N section only | `/sdlc-gate N` or Claude calls `read_sdlc_section` |
| Full document needed | Entire `SDLC_VALIDATION.md` | `/sdlc-load` (explicit, on demand) |
| Session end | Session log entry written | Automatic (`Stop` hook) |

The Section 0 protocol rules (verification, gate discipline, scope discipline, decision discipline) are embedded in `CLAUDE.md` and loaded by Claude Code on every session — no file read required.

---

## Slash commands

| Command | What it does |
|---|---|
| `/sdlc-init` | Copy the `SDLC_VALIDATION.md` template into the current project root (run once per new project) |
| `/sdlc-status` | Show all gate statuses and flag what is blocking each incomplete stage |
| `/sdlc-gate <N>` | Check gate N — if blocked, reads the stage section and lists missing artifacts |
| `/sdlc-load` | Load the full `SDLC_VALIDATION.md` into context (use when you need to reference multiple sections at once) |

---

## MCP tools (called by Claude automatically)

| Tool | Purpose |
|---|---|
| `init_project` | Copy bundled template to project root — never overwrites an existing file |
| `get_project_identity` | Read Section 1 (project identity table) |
| `check_gate_status` | Return gate status table; `isError: true` if a specific stage gate is not PASSED |
| `read_sdlc_section` | Fetch a single section by heading — stage criteria, decision log, etc. |
| `load_sdlc_context` | Load full document (used by `/sdlc-load`) |
| `log_decision` | Append a row to Section 15 (Decision Log) |
| `log_open_item` | Append an out-of-scope issue to Section 16 (Open Items) |
| `update_session_log` | Append a session summary to Section 18 (Session Log) |
| `verify_artifact` | Check whether a required file or directory exists, return `file:line` citation |

All 8 tools are pre-approved — they fire without prompting you.

---

## How to use

### Start a new project

1. Open the project in VS Code with Claude Code active.
2. Run `/sdlc-init` — the plugin copies the `SDLC_VALIDATION.md` template into your project root automatically.
3. Tell Claude what you want to build. It will fill in Section 1 (Project Identity) and ask for confirmation before creating anything.

### Continue an existing project

Open VS Code. The plugin shows you where you left off (gate table + last session log entry). Say what you want to work on.

### Advance a gate

When all criteria for a stage are met, tell Claude "Stage N passed." Claude calls `check_gate_status` to verify, then updates the gate status in `SDLC_VALIDATION.md`.

---

## Gate enforcement

When you ask Claude to write code for a stage, it calls `check_gate_status` for that stage first. If the gate is not `PASSED`:

- The tool returns `isError: true`
- Claude stops and presents the gate status
- Claude calls `read_sdlc_section` to list what is missing
- Claude asks how you want to proceed

It does not write code. It does not work around the gate. It waits.

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

## Stages reference

| Stage | Name | When |
|---|---|---|
| 1 | Inception & Requirements | Project start — spec.md, roadmap.md |
| 2 | Architecture & Design | After Stage 1 — architecture.md, ADR log |
| 3 | Dev Environment & Standards | After Stage 2 — CLAUDE.md, linter, tsconfig |
| 4 | Test Harness | After Stage 3 — empty test files, test runner |
| 5 | CI/CD Pipeline | After Stage 4 — ci.yml, CONTRIBUTING.md |
| 6 | Feature Implementation | After Stage 5 — one prompt per FR- item |
| 7 | Observability | Before staging deploy |
| 8 | Security | Before any user data is stored |
| 9 | Performance | Before launch / public beta |
| 10 | Data & Analytics | Before reporting features go live |

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
│   ├── sdlc-status.md       ← /sdlc-status slash command
│   ├── sdlc-gate.md         ← /sdlc-gate slash command
│   └── sdlc-load.md         ← /sdlc-load slash command
└── package.json             ← runtime deps only

sdlc-mcp-server/
└── src/                     ← TypeScript source (build → plugin/dist/)
```

The MCP server runs as a subprocess (`node plugin/dist/index.js`) using stdio transport. `${CLAUDE_PLUGIN_ROOT}` in `marketplace.json` is replaced with the plugin install path at runtime.

---

## Without the plugin (manual workflow)

If you are not using the Claude Code marketplace, you can still use `SDLC_VALIDATION.md` manually. Start each session with:

```
Read SDLC_VALIDATION.md. Read Section 18 (Session Log) to understand where we left off.

Report:
- Current gate status (Quick Reference table at the bottom)
- What was in progress at the end of the last session
- What the next step is

Wait for my instruction before doing anything.
```

Then follow the gate progression: tell Claude which stage you are on, ask it to read that stage's gate section, and confirm each gate before moving forward.
