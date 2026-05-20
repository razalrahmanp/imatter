---
name: sdlc-playwright
description: Use after unit and integration tests pass, before claiming a UI-facing feature complete — spawns a Playwright sub-agent to exercise the running app and report back.
---

# sdlc-playwright

## When to invoke

Invoke after `superpowers:verification-before-completion` confirms unit/integration tests pass, but **before** reporting the task done, if:

- The changed code is reachable from a browser UI
- The stack profile declares `requires_playwright_mcp: true`
- The user explicitly asks for a live browser check

Skip when:
- The change is backend-only with no UI surface (pure Lambda/API, no frontend path)
- Playwright MCP is not installed (downgrade gracefully — see below)

## Prerequisite check

Before spawning, confirm Playwright MCP is available:
- If the `browser_snapshot` or `browser_navigate` tool is present in your toolset → Playwright MCP is installed. Proceed.
- If not → tell the user: "Playwright MCP is not installed. Stage 4 E2E gate will check for config file existence only, not live browser pass. Install with: `claude mcp add playwright -- npx -y @playwright/mcp@latest`"

## The verification sequence

```
1. Navigate to the feature's entry point
2. Exercise the primary happy path (the core use case)
3. Exercise the primary error path (invalid input, missing auth, etc.)
4. Take a snapshot and report pass/fail per path
```

Do not attempt exhaustive coverage — the E2E suite owns that. This is a smoke check that the feature works in a real browser at all.

## Spawning the verifier sub-agent

Dispatch a sub-agent with this context:
```
You are an E2E verifier. Playwright MCP tools are available.

Feature under test: <feature name from plan>
App URL: <staging URL or localhost>
Auth state: <storage state file path, or credentials if none>

Exercise:
1. Happy path: <describe the user action and expected outcome>
2. Error path: <describe the error scenario and expected UI response>

Report back:
- PASS/FAIL per path
- Screenshot or snapshot on failure
- Any console errors observed
```

The sub-agent reports findings; the main session decides whether to block or proceed.

## Reporting

| Result | Action |
|---|---|
| Both paths PASS | Mark verification complete. Proceed to code review. |
| Happy path FAILS | Block. Return to implementation. Log failure in `.sdlc-tasks/T-<slug>.md`. |
| Error path FAILS | Block. Error handling is part of the feature spec. |
| Snapshot shows unexpected regression | Log as open item in SDLC_VALIDATION.md Section 16. Escalate to user. |

## SDLC gate connection

When Stage 4 (Testing Strategy) is audited:
- If Playwright MCP is installed: criterion "E2E tests run live" can be marked PASSED via this skill.
- If not installed: criterion downgrades to "E2E config file exists" — a weaker but still gatable check.

The `.sdlc-stack.json` profile controls this:
```json
{ "requires_playwright_mcp": true }
```
If `true` and Playwright is missing, Stage 4 audit surfaces a blocking gap.
