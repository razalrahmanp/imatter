# Learning Projects — Claude Session Rules

## Session start protocol

1. Call `sdlc_session_brief` — returns cursor, gates cleared, flagged stages, active-stage gate status, and last Section-18 entry in a single read.
2. Display the brief to the user.
3. Ask what the user wants to work on.

Fallback path if `sdlc_session_brief` is unavailable (e.g. plugin not loaded): read `.sdlc-state.json` directly, then call `read_sdlc_section('18. Session Log')`. This is the pre-tool workflow and is slower — only use if the tool is missing.

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

## Task tier — classify before applying protocol

Before applying anything below, classify the task:

**Trivial** — pick this only if ALL of these hold:
- Single-file edit (or a handful of mechanically identical edits)
- No public interface change (no exported signature, no API route, no schema)
- No user-visible behavior change (comments, log strings, formatting, internal helpers only)
- Under 15 minutes of effort
- Not in the **Forbidden** list below
- Not in critical-path code (auth, persistence, billing, tenant isolation)

**Feature** — anything else. When in doubt, feature.

Trivial-tier work **skips**:
- Decision Log entries (Section 14)
- Open Items negotiation for sibling improvements in the same file (Section 15)
- `file:line` citation discipline on routine findings (still cite for gate-passing claims and deviation reports)
- Gate pre-checks — trivial work does not advance a stage

Trivial-tier work **still respects**:
- The Forbidden list — destructive or shared-state actions always require approval
- Verification — never guess at file contents; read what you're editing
- AI attribution on commits
- End-of-session duty — Section 18 is per session, not per task

If a trivial task grows mid-stream (touches a public interface, becomes the third "small" edit in the same area, exceeds 15 min), stop and re-classify as feature.

---

## Protocol rules (SDLC Section 0 — always active)

**0.1 Verification over assertion**
- Never assume a file, function, config value, or dependency exists. Read it or grep for it.
- Cite `file:line` when the finding passes a gate, reports a doc/code deviation, or is the basis for action the user will take. Routine context reads don't need a citation.
- Anything you cannot verify from the codebase is `UNVERIFIED` — say so and ask.

**0.2 Gate discipline**
- Before starting work in any stage, read that stage's gate section in the SDLC file.
- Do not begin Stage N work until Stage N's gate status is `PASSED`.
- Do not mark a gate `PASSED` unless every criterion has a `file:line` citation or explicit user confirmation.
- If a prerequisite gate is `NOT STARTED` or `IN PROGRESS`, stop and state what is missing.

**0.3 Scope discipline**
- Only implement what is explicitly listed in the current stage's approved scope.
- No new features, public interface changes, or new dependencies without approval.
- Small in-place improvements (rename, typo, unused import) in a file you're already editing are allowed if under ~10 lines and behavior-preserving.
- For larger out-of-scope items, log in **Section 15 (Open Items)** and ask — never fix silently.

**0.4 Decision discipline**
- Log decisions in **Section 14 (Decision Log)** when they crystallize.
- Log *before* acting for hard-to-reverse choices: schema, dependency, framework, auth pattern, public API.
- Log *after* the code proves it for reversible choices: internal patterns, file layout, naming, refactor approach.
- Do not re-litigate logged decisions — if one is wrong, raise it explicitly.

**0.5 Deviation protocol**
- If the codebase contradicts a PASSED gate or logged decision, the code wins.
- Flag the conflict: state what the document says, what the code shows, and ask the user how to resolve it. Then update the SDLC file.

**0.7 Spike mode** (exploratory work outside gates)
- Declare "spike" when you need to learn before committing.
- Spike work skips gates, 0.3, and 0.4. Spikes don't advance the cursor or mark gates PASSED.
- Resolve by either discarding the code, or declaring it real, classifying its tier, and applying the matching rules.
- The Forbidden list still applies during spikes.

---

## Forbidden without explicit user approval

- Changing a database schema or migration
- Adding, removing, or upgrading a dependency
- Touching authentication, authorization, or tenant-isolation logic
- Committing, pushing, or opening a pull request

---

## AI attribution — always required

Every commit made during a Claude Code session must include:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

This applies to all commits, including single-line fixes. A PostToolUse hook will warn if a `git commit` command is missing this trailer. Never use `--no-verify` to bypass it.

---

## Testing posture — TDD as a tool, not a default

TDD applies when the test will outlive the implementation many times:

- **Use TDD for**: critical paths (auth, billing, persistence, gate logic), bug regressions (write the failing test first, then fix), public-interface code (anything other code consumes), and code marked "keeping" (will ship, will be maintained).
- **Skip TDD for**: exploratory code, learning spikes, throwaway scripts, internal helpers whose interface you don't yet understand. Manual verification (run it, look at the output) is enough until the interface stabilizes.
- **Convert at the boundary**: when exploratory code crosses into "keeping," write tests for the now-stable interface. Don't write tests for interfaces you're still discovering.
- The `verification-before-completion` skill applies proportionally: trivial-tier work just confirms the edit landed; feature-tier work runs tests and cites green output.

---

## End-of-session duty

If the session changed gate status, logged a decision, or hit a blocker, append one line to **Section 18 (Session Log)** in the active SDLC_VALIDATION.md:

```
| <date> | <what was done> | <gates changed, or "none"> | <blockers / next step> |
```

Pure question-and-answer sessions or trivial-tier work don't need an entry. Skip if nothing material changed.
