# Learning Projects — Claude Session Rules

## Session start protocol

1. Locate `.sdlc-state.json` for the active scope:
   - Check the current subdirectory first, then the project root.
   - If found: read it — cursor stage, gate history, and flagged stages are all here (~3KB).
   - If not found: locate `SDLC_VALIDATION.md` instead and use the Quick Reference table for gate status.
2. Call `read_sdlc_section('18. Session Log')` — last session's notes (~0.5KB).
3. Display to the user:
   - Cursor: Stage N — `<status>`
   - Gates cleared: list from `history[].stage` + `history[].gate`
   - Last session: one-line summary from Section 18
   - Flagged: any entries in `flagged[]`
4. Ask what the user wants to work on.

DO NOT read the full SDLC_VALIDATION.md at startup.

## Knowledge access rules (surgical reads only)

Load content on demand — never pre-load speculatively:

- **Stage content** → `read_sdlc_section('N. Stage N — <name>')` when entering that stage
- **Gate criteria** → `read_sdlc_section` for that stage's gate heading when checking a gate
- **Protocol rules** → already present in this CLAUDE.md; do not re-read Section 0
- **Session state** → `get_session_context` — never read `.sdlc-state.json` directly after startup
- **Skills** → `sdlc_skills_fetch` — never read skill files directly
- **Full doc** → `load_sdlc_context` only when the user explicitly requests a full framework review

If you find yourself wanting the full doc, pick the specific section instead.

---

## Protocol rules (SDLC Section 0 — always active)

**0.1 Verification over assertion**
- Never assume a file, function, config value, or dependency exists. Read it or grep for it.
- Every finding must be cited as `file:line`. A finding without a citation is not a finding.
- Anything you cannot verify from the codebase is `UNVERIFIED` — say so and ask.

**0.2 Gate discipline**
- Before starting work in any stage, read that stage's gate section in the SDLC file.
- Do not begin Stage N work until Stage N's gate status is `PASSED`.
- Do not mark a gate `PASSED` unless every criterion has a `file:line` citation or explicit user confirmation.
- If a prerequisite gate is `NOT STARTED` or `IN PROGRESS`, stop and state what is missing.

**0.3 Scope discipline**
- Only implement what is explicitly listed in the current stage's approved scope.
- If you notice something out of scope that should be fixed, log it in **Section 15 (Open Items)** and ask — never fix silently.

**0.4 Decision discipline**
- Log every significant decision (technology choice, pattern, architectural trade-off, scope change) in **Section 14 (Decision Log)** before acting on it.
- Do not re-litigate logged decisions — if one is wrong, raise it explicitly.

**0.5 Deviation protocol**
- If the codebase contradicts a PASSED gate or logged decision, the code wins.
- Flag the conflict: state what the document says, what the code shows, and ask the user how to resolve it. Then update the SDLC file.

---

## Forbidden without explicit user approval

- Creating new files outside the agreed project structure
- Changing a database schema or migration
- Adding, removing, or upgrading a dependency
- Modifying CI/CD configuration
- Touching authentication, authorization, or tenant-isolation logic
- Making any external API call or writing to any external service
- Deleting or renaming any file
- Committing, pushing, or opening a pull request

---

## AI attribution — always required

Every commit made during a Claude Code session must include:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

This applies to all commits, including single-line fixes. A PostToolUse hook will warn if a `git commit` command is missing this trailer. Never use `--no-verify` to bypass it.

---

## End-of-session duty

Before closing the session, append one line to **Section 18 (Session Log)** in the active SDLC_VALIDATION.md:

```
| <date> | <what was done> | <gates changed, or "none"> | <blockers / next step> |
```

This keeps the next session from re-deriving context.
