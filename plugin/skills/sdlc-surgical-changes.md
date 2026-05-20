---
name: sdlc-surgical-changes
description: Use before writing any code change — keeps every changed line traceable to the user's explicit request, prevents scope creep and unrequested refactors.
---

## Rule

Every line you change must trace directly to the user's stated request. No "while I'm here" cleanups, no opportunistic refactors, no fixing unrelated bugs you spot in passing.

## Before writing

1. State the scope of the change in one sentence: "I will change X in file Y to do Z."
2. If the scope crosses files you weren't asked to touch, stop and ask first.
3. If you notice a bug or smell that is *not* in the requested scope, log it in Section 16 (Open Items) of `SDLC_VALIDATION.md` via `log_open_item` — do not fix it silently.

## After writing

Run `git diff --stat` and read every file listed. For each:
- Is this file in the stated scope? If no → revert.
- Does every changed hunk implement the requested change? If no → revert the extra hunks.

## Red flags

| Thought | Action |
|---|---|
| "While I'm in this file, I'll also..." | Stop. Log as open item. |
| "This variable name is bad, let me rename it" | Not in scope. Don't. |
| "Let me also add a test for that other function" | Not in scope. Log it. |
| "I'll just reformat this block" | Not in scope. Don't. |

## When this rule does not apply

- The user explicitly asks for cleanup, refactor, or "anything else you notice"
- A change is mechanically forced by your edit (e.g., updating a type that's now wrong)
- Auto-formatters running as part of save hooks

Everything else: stay surgical.
