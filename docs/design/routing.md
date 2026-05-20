# Routing — User Intent → Plugin Entry Point

This document is the authoritative routing table for the SDLC Validation plugin. It maps every common user intent to the entry point that should fire. Use it to:

1. Diagnose ambiguous routing ("Claude called the wrong tool").
2. Decide where new functionality belongs (MCP tool? Agent? Skill?).
3. Write the `description:` text for any new entry point so it disambiguates from siblings.

---

## Routing layers

```
User intent
     │
     ▼
┌────────────────────────────────────────────────┐
│ 1. Slash command typed?                        │
│    /sdlc-init, /sdlc-work N, /sdlc-status, ... │
│    → SKILL fires (highest precedence)          │
└────────────────────────────────────────────────┘
                  │ no
                  ▼
┌────────────────────────────────────────────────┐
│ 2. Verification task with citations needed?    │
│    "audit", "verify", "review", "scan"         │
│    → AGENT fires via Task tool                 │
└────────────────────────────────────────────────┘
                  │ no
                  ▼
┌────────────────────────────────────────────────┐
│ 3. Stateful operation on SDLC artifacts?       │
│    "check", "log", "show", "advance"           │
│    → MCP TOOL fires                            │
└────────────────────────────────────────────────┘
                  │ no
                  ▼
┌────────────────────────────────────────────────┐
│ 4. Read/grep/edit code or docs?                │
│    → BUILT-IN TOOL (Read, Grep, Edit, Glob)    │
└────────────────────────────────────────────────┘
```

The layered structure means: **a skill that fires can call agents, which can call MCP tools, which can call built-in tools**. Lower layers never reach back up.

---

## Boundary rules

| If the task is... | Use a | Because |
|---|---|---|
| Stateful, fast, deterministic (read state, append row, check status) | **MCP tool** | No LLM call needed; just data ops |
| Verification with citations (audit spec, scan secrets, check coverage) | **Agent** | Needs LLM reasoning over file contents |
| Multi-step user-facing workflow (init project, work through a stage) | **Skill** | Orchestrates agents + MCP tools across turns |
| Pure read/grep operation on code | **Built-in** | Skills and agents call these internally |

A useful test: if you can answer the request without an LLM, it's an MCP tool. If you need an LLM to read and reason, it's an agent. If you need to guide a multi-turn conversation, it's a skill.

---

## Intent → entry point table

### Project lifecycle

| User says | Entry point | Type | Notes |
|---|---|---|---|
| "set up SDLC", "start a new project", "/sdlc-init" | `sdlc-init` | Skill | Copies template, initialises state, asks Stage 1 questions |
| "where are we", "show progress", "/sdlc-status" | `sdlc-status` | Skill | Wraps `check_gate_status` with framing |
| "work on stage N", "/sdlc-work 2" | `sdlc-work` | Skill | Loads stage N section, asks targeted questions |
| "load the full SDLC doc", "/sdlc-load" | `sdlc-load` | Skill | Calls `load_sdlc_context` |
| (session start) | `SessionStart` hook | Hook | Auto-fires `get_project_identity` + `check_gate_status` |
| (session end) | `Stop` hook | Hook | Auto-fires `update_session_log` |

### Gate checks (fast, status-only)

| User says | Entry point | Type | Notes |
|---|---|---|---|
| "is stage 4 ready", "check stage 4", "status of stage 4" | `check_gate_status` | MCP tool | Returns PASSED/IN PROGRESS/NOT STARTED |
| "show all gates" | `check_gate_status` (no stage arg) | MCP tool | Returns full table |
| "/sdlc-gate 3" | `sdlc-gate` | Skill | Same as above but with framing |

### Gate verification (citations, evidence)

| User says | Entry point | Type | Notes |
|---|---|---|---|
| "verify gate 4 criteria", "collect evidence for stage 4" | `sdlc-gate-evidence-collector` | Agent | Reads criteria, returns file:line for each |
| "audit the spec", "check Stage 1 readiness" | `sdlc-spec-compliance-auditor` | Agent | Five-property structured audit |
| "audit coverage", "what's untested" | `sdlc-test-coverage-auditor` | Agent | Runs tests, parses output |
| "security review", "OWASP check", "scan for secrets" | `sdlc-security-reviewer` | Agent | Four-check security audit |

### Audit trail (decision/scope/session logs)

| User says | Entry point | Type | Notes |
|---|---|---|---|
| "log this decision: X" | `log_decision` | MCP tool | Appends to Section 15 |
| "out-of-scope: X" | `log_open_item` | MCP tool | Appends to Section 16 |
| "session end summary" | `update_session_log` | MCP tool | Appends to Section 18 (also fired by Stop hook) |

### Multi-agent orchestration

| User says | Entry point | Type | Notes |
|---|---|---|---|
| "run all stage 4 agents", "dispatch agents for stage N" | `sdlc_dispatch_agents` | MCP tool | Fan out to all sub-agents configured for the stage |
| "show agent progress" | `sdlc_dispatch_status` | MCP tool | Read-only status of dispatched agents |
| "synthesise findings, decide gate" | `sdlc_gate_run` | MCP tool | After all agents have written, decide PASS/FAIL |

### Upgrade lifecycle

| User says | Entry point | Type | Notes |
|---|---|---|---|
| "what would upgrading change" | `sdlc-upgrade-check` (CLI) | Binary | Pre-flight; reports drift and edits |
| "apply pending migrations" | `sdlc-migrate --apply` (CLI) | Binary | Runs migrations with backup |
| "roll back" | `sdlc-migrate --rollback` (CLI) | Binary | Restore from `.sdlc-backups/` |
| "tag this doc with markers" | `sdlc-tag` (CLI) | Binary | One-shot region marker injection |
| "audit gates for CI" | `sdlc-audit` (CLI) | Binary | JSON/text output with exit codes |

### Production coding support

| User says | Entry point | Type | Notes |
|---|---|---|---|
| "checkpoint this writing task" | `sdlc_task_checkpoint` | MCP tool | Flush writer state, return compact reload payload |
| "diagnose this build error" | `sdlc_error_diagnose` | MCP tool | Parse tsc/eslint/jest output into structured errors |
| "fetch the lambda-handler skill" | `sdlc_skills_fetch` | MCP tool | Layered skill registry lookup |

---

## Disambiguation cases

When two entry points could plausibly match, the boundary rules below decide.

### `check_gate_status` vs `sdlc-gate-evidence-collector`

Both touch gate criteria. The boundary:

- **`check_gate_status`** — answers "is the gate marked PASSED in the doc?" by reading the Quick Reference table. Fast, deterministic, no LLM. Use for routine status display.
- **`sdlc-gate-evidence-collector`** — answers "for each criterion, what's the evidence?" by reading the criteria text and searching the codebase. Slow, LLM-driven, expensive. Use before marking a gate PASSED for the first time.

Routing rule: status questions → MCP tool. Evidence questions → agent.

### `sdlc-init` (skill) vs `init_project` (MCP tool)

- **`init_project`** — copies the template file. One operation, no questions.
- **`sdlc-init`** — wraps `init_project`, then guides the user through Stage 1 questions and writes `docs/spec.md`, `docs/roadmap.md`. Multi-turn.

Routing rule: if the user just wants the file copied, they call the MCP tool directly. If they want guided setup, the skill fires.

### `load_sdlc_context` vs `read_sdlc_section` vs `sdlc_init`

- **`load_sdlc_context`** — full document (~60 KB). Use only for full framework review.
- **`read_sdlc_section`** — one heading. Use for stage-specific work.
- **`sdlc_init`** — current stage section + history summaries + imports. Use at session start to assemble fixed-budget context.

Routing rule: prefer the smallest payload that answers the question. `sdlc_init` for stage entry; `read_sdlc_section` for one-off lookups; `load_sdlc_context` rarely.

### `/sdlc-work` (skill) vs `sdlc_init` (MCP tool)

- **`sdlc_init`** — assembles context, returns a payload. One call. No user interaction.
- **`/sdlc-work N`** — calls `sdlc_init`, then asks the user the stage-specific questions, then writes artefacts.

Routing rule: programmatic context load → MCP tool. Interactive walkthrough → skill.

---

## How to write a good `description:`

Every entry point's `description:` is what Claude reads to decide routing. Three rules:

1. **Lead with the verb the user would say.** "Audit", "verify", "check", "show", "log". Not "Implements audit logic" — that's documentation, not routing bait.
2. **Enumerate the trigger phrases when the action verb is ambiguous.** The security reviewer says: `Trigger when the user says "security review", "OWASP check", or "scan for secrets".`
3. **State what the entry point will NOT do.** This is the disambiguation lever. The evidence collector says `read-only; the writer agent applies fixes if a criterion fails` — this routes "fix the criterion" requests away from it.

A description that just describes the implementation will mis-route. A description that lists trigger phrases routes deterministically.

---

## When something mis-routes

Diagnosing wrong routing:

1. Read the user's request verbatim and check it against every potentially matching `description:`.
2. If two descriptions match equally, that's a description bug — make one more specific or add a "not for X" clause.
3. If neither matches but the user expected one to, the description is missing a trigger phrase — add it.
4. If a skill should have fired but the MCP tool fired instead, the user didn't invoke the slash command. Skills don't route from prose; they route from `/command`.

The routing layer is honest about its limits: prose-based intent matching has irreducible ambiguity. Hooks and protocol rules close the gaps where determinism matters.
