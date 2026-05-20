---
name: sdlc-dispatcher
description: Use at the start of every session in a project that has an SDLC_VALIDATION.md. Routes between audit mode (gate work) and coding mode (feature work) based on .sdlc-state.json and the user's request.
---

# sdlc-dispatcher

## What this skill does

Reads project state at session start and routes to the right workflow before any other action.

## When to invoke

- Session starts in a directory containing `SDLC_VALIDATION.md`
- User asks to build, add, fix, or change something (coding task)
- User asks about gate status, stage progress, or what to do next (audit task)

## Step 1 — Read state

Check whether `.sdlc-state.json` exists in the project root.

**If it exists:** Read it. Extract:
- `cursor.stage` — the active stage number
- `cursor.status` — `not_started`, `in_progress`, or `passed`
- `history[last].gate` — the most recent PASSED gate

**If it does not exist:** The project has not been initialized with `sdlc_init`. Tell the user: "This project does not have SDLC state yet. Run `/sdlc-init` to set it up." Stop.

## Step 2 — Classify the request

| Signal | Classification |
|---|---|
| "add X", "build X", "fix X", "implement X", "change X" | **coding task** |
| "check gate", "what stage", "status", "what's passing", "audit" | **audit task** |
| Ambiguous or session-start with no request yet | **present status, ask** |

## Step 3 — Route

### Audit task → gate workflow
Call `check_gate_status` for the current stage. Present results. Use `/sdlc-work <stage>` if the user wants to advance a gate.

### Coding task → coding workflow
Before writing a single line of code:

1. **Gate check** — confirm `cursor.stage` gate is `in_progress` or `passed`. If `not_started`, block: "Stage N gate must be started before writing feature code. Run `/sdlc-work N` first."

2. **Brainstorm** — invoke `superpowers:brainstorming` to clarify intent. Do not skip even if the request seems clear.

3. **Plan** — invoke `superpowers:writing-plans` to decompose into tasks. Write the plan to `.sdlc-tasks/T-<date>-<slug>.md`.

4. **Execute** — invoke `superpowers:subagent-driven-development` to run each task in the plan. Each sub-agent reads the relevant SDLC skills before writing code.

5. **Verify** — after sub-agent completes, invoke `superpowers:verification-before-completion`. If Playwright MCP is available, also run `/sdlc-playwright` before claiming done.

### Ambiguous / no request yet
Present the current state table and ask:

```
Stage <N> — <name> — <status>
Last passed: Stage <M> — <name> — <date>

What would you like to work on?
```

## Red flags — do not skip routing

| Thought | Reality |
|---|---|
| "Request is simple, I'll just write the code" | All coding tasks go through the coding workflow — no exceptions |
| "Gate is already in_progress, I can code" | in_progress means the gate is being worked, not that coding is free — check the specific stage's forbidden list |
| "Brainstorming adds overhead" | Skipping brainstorming is the single largest source of rework |
| "Plan already exists in my context" | Plans must be written to `.sdlc-tasks/` so they survive a session crash |
