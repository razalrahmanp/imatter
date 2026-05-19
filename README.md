# SDLC Validation Framework — Usage Guide

A Claude Code control document that enforces a verified software delivery lifecycle on every project.
Drop one file into any workspace. Claude reads it, fills it, and never deviates from the plan.

---

## What this is

`SDLC_VALIDATION.md` is a single markdown file you copy into the root of every new project.
It tells Claude:

- **What production-grade looks like** at every stage (Inception → Data Engineering)
- **What to verify** before calling any stage done — with exact grep/read commands
- **Why each check matters** — so Claude understands the severity, not just the rule
- **What it is forbidden to do** without your explicit approval
- **How to manage its own context** so it does not drift or hallucinate across sessions

Claude fills the document from your repo files. You confirm. Nothing gets built until the gates pass.

---

## What you get

| Without this document | With this document |
|---|---|
| Claude invents architecture | Claude derives architecture from your spec, logs every decision |
| Claude adds features you did not ask for | Claude is forbidden from touching anything outside current gate scope |
| Claude guesses file paths and tech stack | Claude reads the repo and cites every value with `file:line` |
| Quality standards drift across sessions | Every session re-reads the same control document |
| No record of why decisions were made | Append-only Decision Log — every choice is reasoned and approved |
| Tests added as an afterthought | Test harness created before implementation, enforced by gate |

---

## Setup — one time per project

1. Copy `SDLC_VALIDATION.md` into the **root folder** of your new project in VS Code.
2. Open the project in VS Code with the Claude Code extension active.
3. Use the prompts below in order. Each prompt ends with a confirmation step — do not skip it.

That is all. Claude handles everything else.

---

## The prompts — copy, change the placeholders, paste

Every prompt below is ready to use. The only parts you change are marked `[LIKE THIS]`.
Everything else stays exactly as written.

---

### Prompt 1 — Session start (use this every time you open a new session)

> Use this prompt at the very start of every Claude Code session for this project.
> On the first session it kicks off the full setup. On later sessions it re-anchors Claude to the current state.

```
Project: [YOUR PROJECT NAME]
Owner: [YOUR NAME]
Date: [TODAY'S DATE]

What we are building:
[2–4 sentences. What does the product do? Who uses it?
Example: A web app for a coffee shop where customers browse the menu
and place orders from their table. Staff see a live order queue and
mark orders ready. The owner manages the menu and views daily sales.]

Users:
- [USER TYPE 1 — what they do]
- [USER TYPE 2 — what they do]
- [USER TYPE 3 — what they do, if applicable]

Must have in v1:
- [FEATURE 1]
- [FEATURE 2]
- [FEATURE 3]
- [add as many as needed]

Out of scope for v1:
- [DEFERRED FEATURE 1 — and why]
- [DEFERRED FEATURE 2 — and why]

Non-functional targets:

- [KEY ACTION] must complete in < [X] ms p95
- [ANOTHER KEY ACTION] must complete in < [X] ms p95
- System must handle [N] concurrent [users / orders / requests]

---

Read SDLC_VALIDATION.md in this workspace. It is the control document
for this project.

Do the following in order and stop after each step for my confirmation:

1. Resolve §1 (Project Identity) by reading any existing files in
   the repo — package.json, IaC files, spec documents, architecture
   docs. Fill every row with the value you found and its file:line
   citation. Mark anything you cannot find UNVERIFIED.

2. Resolve all [PATH] placeholders in the stage gates by searching
   the repo for the likely files. If a file does not exist yet, say
   so — do not invent a path.

3. Report which stages have existing artifacts and which are
   NOT STARTED.

4. Tell me what Stage 1 artifacts need to be created and ask for
   my go-ahead before creating anything.
```

**What Claude does:** Reads the repo, fills §1 with citations, lists what exists and what is missing, asks before touching anything.

**What you do:** Review the §1 table. Correct any wrong values. Say "confirmed" or tell Claude what to fix.

---

### Prompt 2 — Create Stage 1 artifacts (Inception & Requirements)

> Use after confirming §1. Skip if spec documents already exist.

```
Stage 1 confirmed. Create the Stage 1 artifacts now:

- [SPEC_FOLDER]/spec.md
  Include: functional requirements with FR-x.y.z identifiers,
  non-functional requirements with the p95 targets I gave you,
  an in-scope / out-of-scope table with deferral reasons for each
  deferred item, GA-gate acceptance criteria, and a personas section.

- [SPEC_FOLDER]/roadmap.md
  Include: v1 scope summary and a deferral table with version markers.

Use only the information I gave you in Prompt 1.
Do not invent requirements I did not mention.
Do not write any code.

When done, show me the Stage 1 gate checklist from SDLC_VALIDATION.md
with your evidence file:line for every row.
```

> **Change:** Replace `[SPEC_FOLDER]` with your preferred docs folder name, e.g. `docs` or `specs`.

**What Claude does:** Creates `spec.md` and `roadmap.md` using only what you described. Shows you the Stage 1 gate table filled with citations.

**What you do:** Read the spec. Add, correct, or remove requirements. When it looks right, say "Stage 1 passed."

---

### Prompt 3 — Create Stage 2 artifacts (Architecture & Design)

> Use after Stage 1 is passed.

```
Stage 1 passed. Move to Stage 2.

Create the following:

- docs/architecture.md
  Cover: component diagram (in text or Mermaid), technology choices
  with rationale, how authentication is handled, how multi-tenancy
  or data isolation is handled (if applicable), API contract shape,
  and the failure mode for every external dependency.

- docs/decisions.md
  This is the Architecture Decision Record log. Create one entry for
  every technology choice you make while writing architecture.md.
  Format: Date | Decision | Rationale | Alternatives considered.

Only choose technologies that are derivable from what I have already
told you. If you need to make a choice I have not specified, log it
in decisions.md and ask me before proceeding.

When done, show me the Stage 2 gate checklist with evidence.
```

**What Claude does:** Creates architecture and decision documents. Pauses and asks before making any unspecified choice.

**What you do:** Review the architecture. Approve or redirect any open decisions. Say "Stage 2 passed."

---

### Prompt 4 — Create CLAUDE.md and dev tooling (Stage 3)

> Use after Stage 2 is passed. This is when CLAUDE.md gets created.

```
Stage 2 passed. Move to Stage 3.

Create the following:

- CLAUDE.md at the repo root
  Include: the agreed tech stack from §1 and Stage 2 decisions,
  branching strategy, linting and formatting rules, TypeScript strict
  mode requirement (if applicable), the one agreed data-fetching
  pattern, the one agreed error-handling pattern, folder structure
  convention, and these security rules (copy verbatim):
    - Never import a privileged / service-role database client in
      browser or client-side code
    - Never log PII fields (email, phone, name, address)
    - Never send PII in LLM prompts without explicit approval

- [LINTER_CONFIG] (e.g. .eslintrc.json or biome.json)
- tsconfig.json with strict: true and noImplicitAny: true
  (if TypeScript project)

When done, grep the repo for any violations of the top 5 rules
in CLAUDE.md and report what you find.

Show me the Stage 3 gate checklist with evidence when done.
```

> **Change:** Replace `[LINTER_CONFIG]` with your preferred linter config filename.

**What Claude does:** Creates `CLAUDE.md`, linter config, and tsconfig. Then immediately checks for violations of its own rules.

**What you do:** Review CLAUDE.md. This is your coding standard for the whole project — make sure it says what you actually want enforced. Say "Stage 3 passed."

---

### Prompt 5 — Test harness before code (Stage 4)

> Use after Stage 3 is passed. Tests come before implementation — always.

```
Stage 3 passed. Move to Stage 4.

From spec.md, identify every module that handles:
- Money, pricing, or financial calculation
- Authentication or authorisation
- Data integrity or state transitions

For each of those modules:
1. Create an empty test file with describe blocks and it() stubs
   for the key behaviours listed in spec.md.
   Do not write implementation yet — stubs only.
2. Configure the test runner (vitest or jest) if not already present.
3. Add a "test" script to package.json.
4. Add a coverage configuration targeting [TARGET]% line coverage.

Show me the Stage 4 gate checklist with evidence when done.
```

> **Change:** Replace `[TARGET]` with your coverage target, e.g. `80`.

**What Claude does:** Creates empty test files with stubs for the highest-risk code. Sets up the test runner. No feature code is written yet.

**What you do:** Check that every high-risk module from your spec has a test file. Say "Stage 4 passed."

---

### Prompt 6 — CI pipeline (Stage 5)

> Use after Stage 4 is passed.

```
Stage 4 passed. Move to Stage 5.

Create .github/workflows/ci.yml (or equivalent for [CI_PROVIDER]).
The pipeline must run on every pull request and must:
1. Install dependencies using the frozen lockfile
2. Run type-check
3. Run the linter
4. Run the test suite — fail the build if any test fails
5. Run the production build
6. Run a dependency vulnerability scan

Create CONTRIBUTING.md describing the branching model and stating
that CI must pass before any merge.

Show me the Stage 5 gate checklist with evidence when done.
```

> **Change:** Replace `[CI_PROVIDER]` with your CI platform, e.g. `GitHub Actions`, `GitLab CI`, `Bitbucket Pipelines`. Leave `.github/workflows/ci.yml` unchanged if using GitHub.

**What Claude does:** Creates the CI config and CONTRIBUTING.md. Every standard from Stages 3 and 4 is now enforced automatically.

**What you do:** Review the CI steps. Say "Stage 5 passed."

---

### Prompt 7 — Build a feature (repeat for each feature)

> Use after Stages 1–5 are passed. Use one instance of this prompt per feature.

```
Gates 1–5 passed. Build [FEATURE NAME].

Spec reference: [FR-x.y.z] from spec.md.

Rules:
- Write the test first, then the implementation.
- Follow every rule in CLAUDE.md.
- Do not touch any file outside the scope of [FR-x.y.z].
- If you need to make a decision not already in decisions.md,
  log it there and ask me before proceeding.
- When done, run the tests and show me the result.
- Show me any new entries you added to decisions.md.
```

> **Change:** Replace `[FEATURE NAME]` with what you are building (e.g. "menu browsing") and `[FR-x.y.z]` with the requirement ID from your spec.

**What Claude does:** Writes the test, then the implementation, then runs the tests. Logs any new decisions. Touches nothing outside the stated scope.

**What you do:** Review the code and test results. Approve or redirect. Move to the next feature.

---

## Stages 6–10 — when to run them

The prompts above cover the build loop (Stages 1–5 + feature work). The remaining stages run at specific milestones:

| Stage | When to run |
|---|---|
| Stage 6 — Deployment & Release | Before the first deploy to any shared environment |
| Stage 7 — Observability | Before the first staging deploy |
| Stage 8 — Security | Before any user data is stored |
| Stage 9 — Performance | Before launch / public beta |
| Stage 10 — Data & Analytics | Before any analytical queries or reporting features go live |

For each of these, the prompt follows the same pattern:

```
Move to Stage [N].
Review the Stage [N] gate in SDLC_VALIDATION.md.
Tell me what artifacts are missing and create what you can
from what already exists in the repo.
Show me the gate checklist with evidence when done.
```

---

## Session continuity — use this at the start of every later session

After the first session, open every new session with this shorter version:

```
Project: [YOUR PROJECT NAME]

Read SDLC_VALIDATION.md. Read the Session Log (Section 18) to
understand where we left off.

Report:
- Current gate status (which stages are PASSED / IN PROGRESS / NOT STARTED)
- What was in progress at the end of the last session
- What the next step is

Wait for my instruction before doing anything.
```

---

## Rules Claude operates under — summary

These come from §0 of `SDLC_VALIDATION.md` and are active at all times:

- **Never assume a file exists.** Read it or grep for it. Every finding needs `file:line`.
- **Never start Stage N implementation** until Stage N's gate is PASSED.
- **Never add features, refactor, or fix things outside the current scope.**
- **Never make an architectural decision** without logging it in `decisions.md` and asking first.
- **Never put secrets, auth logic, or privileged database clients in browser code.** Ever.
- **Never log or send PII** without explicit approval.
- **If reality in the code contradicts the document, the code wins.** Flag the conflict, ask how to resolve it, update the document.

---

## File structure after full setup

```
your-project/
├── SDLC_VALIDATION.md        ← the control document (copied from this repo)
├── CLAUDE.md                 ← coding standards (created in Stage 3)
├── CONTRIBUTING.md           ← branching model (created in Stage 5)
├── docs/
│   ├── spec.md               ← requirements with FR- IDs (Stage 1)
│   ├── roadmap.md            ← v1 scope and deferrals (Stage 1)
│   ├── architecture.md       ← component design (Stage 2)
│   └── decisions.md          ← ADR log (Stage 2, ongoing)
├── .github/workflows/
│   └── ci.yml                ← CI pipeline (Stage 5)
├── src/                      ← application code (Stage 7+)
└── [your project files]
```

---

## Quick reference — prompt order

| # | Prompt | When |
|---|---|---|
| 1 | Session start + §1 resolution | Every session (full version on first session) |
| 2 | Create Stage 1 artifacts (spec + roadmap) | Once, at project start |
| 3 | Create Stage 2 artifacts (architecture + decisions) | Once, after Stage 1 passed |
| 4 | Create CLAUDE.md + dev tooling | Once, after Stage 2 passed |
| 5 | Create test harness | Once, after Stage 3 passed |
| 6 | Create CI pipeline | Once, after Stage 4 passed |
| 7 | Build a feature | Repeat for each FR- item in spec |
| — | Later session start | Every session after the first |
