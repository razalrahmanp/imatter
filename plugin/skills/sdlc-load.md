---
description: Load the full SDLC_VALIDATION.md into context when you need to reference multiple sections at once
---

Call `load_sdlc_context` with `project_root` set to the current working directory.

Use this only when:
- The user asks to see the full SDLC document
- You need to cross-reference multiple stage sections simultaneously
- You are auditing the entire project against all gates

For single-stage work, use `/sdlc-gate $ARGUMENTS` instead — it fetches only the relevant section and costs a fraction of the context.
