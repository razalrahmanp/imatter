---
description: Initialize a new project — copies the SDLC template and guides the user through structured questions to complete Section 1 and Stage 1 artifacts
---

Step 1 — Copy template
Call `init_project` with `project_root` set to the current working directory.
- If already exists: skip to Step 2.
- If created: tell the user "SDLC_VALIDATION.md created. I'll now collect your project details — I'll ask one question at a time."

Step 2 — Collect project details (ONE question per message — wait for answer before continuing)

Ask in this exact order, one at a time:

1. "What is the name of your project?"
2. "In 2–4 sentences: what does it do, and who uses it?"
3. "List your user types (personas). For each, one line: role — what they do. Example: Customer — browses menu and places orders."
4. "List your must-have features for v1. One per line. I'll turn these into FR- requirements."
5. "What is explicitly out of scope for v1? For each item, briefly say why it's deferred."
6. "Any performance or scale requirements? For example: 'search < 200ms p95', 'handle 500 concurrent users'. Type 'none' to skip."
7. "What is your preferred tech stack? (language, framework, database, cloud provider) — or say 'read from repo' and I'll detect it."

Step 3 — Fill Section 1
Edit SDLC_VALIDATION.md to fill in the Project Identity table (Section 1) using the answers from Step 2. Replace every [PLACEHOLDER] with the actual value and add a file:line citation where derivable from the repo. Mark anything still UNVERIFIED.

Step 4 — Create Stage 1 artifacts
Create the following files using only the information collected:

- docs/spec.md
  - Functional requirements with FR-1.x.y identifiers (one per feature listed)
  - Non-functional requirements with the exact p95/concurrency targets given
  - In-scope / out-of-scope table with deferral reasons
  - Personas section
  - GA acceptance criteria per FR item

- docs/roadmap.md
  - v1 scope summary
  - Deferral table with version markers (v2, v3, etc.)

Step 5 — Gate evidence
Call `check_gate_status` with stage 1. Show the gate checklist with a file:line citation for every criterion that is now satisfied.

Tell the user: "Does this look right? Say **Stage 1 passed** to mark the gate, or tell me what to change."
