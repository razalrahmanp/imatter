# Learning Projects — Claude Session Rules

## Mandatory startup (run before any work)

1. Locate the SDLC_VALIDATION.md for the active scope:
   - If working in a subdirectory (e.g. `01-sql-running-totals/`), read **that directory's** `SDLC_VALIDATION.md`.
   - If no subdirectory SDLC file exists, read the root `SDLC_VALIDATION.md`.
2. Fill every `[PLACEHOLDER]` by reading the repository — never guess.
3. Present the filled **Section 1 Project Identity** table to the user with `file:line` citations.
4. State the current gate status for every stage (the Quick Reference table at the bottom of the SDLC file).
5. Only then ask what the user wants to work on.

If you cannot locate an SDLC_VALIDATION.md, say so explicitly and stop — do not proceed without it.

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

## End-of-session duty

Before closing the session, append one line to **Section 18 (Session Log)** in the active SDLC_VALIDATION.md:

```
| <date> | <what was done> | <gates changed, or "none"> | <blockers / next step> |
```

This keeps the next session from re-deriving context.
