---
name: sdlc-load
description: Use when auditing the full SDLC document, cross-referencing multiple stage sections, or when the user explicitly asks to load the whole framework — otherwise prefer targeted section reads.
---

Call `load_sdlc_context` with `project_root` set to the current working directory.

Use this only when:
- The user asks to see the full SDLC document
- You need to cross-reference multiple stage sections simultaneously
- You are auditing the entire project against all gates

For single-stage work, use `/sdlc-gate $ARGUMENTS` instead — it fetches only the relevant section and costs a fraction of the context.
