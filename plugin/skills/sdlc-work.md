---
description: Guide the user through a specific SDLC stage — checks the gate, asks targeted questions one at a time, creates required artifacts, and shows gate evidence
---

You will be given a stage number: $ARGUMENTS

---

## Step 1 — Prerequisite check

Call `check_gate_status` with the previous stage number (stage - 1).
- If that gate is not PASSED: stop, explain what is missing, and ask the user to complete the previous stage first.
- If this stage is already PASSED: tell the user, and ask if they want to move to the next stage.

---

## Step 2 — Read the stage requirements

Call `read_sdlc_section` with the correct heading for this stage. Use the heading exactly as it appears in SDLC_VALIDATION.md — for example "2. Stage 1 — Inception & Requirements".

Read what artifacts are required and what the gate criteria are before proceeding.

---

## Step 3 — Check existing artifacts

Call `verify_artifact` for each artifact the stage requires. Note which exist and which are missing.

---

## Step 4 — Gather missing information

For each artifact that does not exist, ask the user targeted questions to gather what you need to build it. Ask ONE question per message. Wait for the answer before asking the next. Never list multiple questions at once.

Use this question guide per stage:

**Stage 1 — Inception & Requirements**
- What is the project name?
- What does it do and who uses it? (2–4 sentences)
- List your user personas — one per line: role — what they do
- List must-have features for v1 (one per line — these become FR- items)
- What is out of scope for v1, and why is each item deferred?
- Any performance or scale requirements? (e.g. "API < 200ms p95", "500 concurrent users") — or "none"
- Preferred tech stack? (language, framework, database, cloud) — or "read from repo"

**Stage 2 — Architecture & Design**
- Confirm or correct the tech stack derived from Stage 1
- How will authentication and authorisation work?
- Is there multi-tenancy or data isolation? If so, how?
- What external services or APIs does this depend on?
- What is the deployment target? (e.g. Vercel, AWS ECS, Railway)
- What is the failure mode if each external dependency goes down?

**Stage 3 — Development Practices**
- Which linter and formatter? (e.g. ESLint + Prettier, Biome, Ruff)
- TypeScript strict mode — yes or no?
- What is the branching strategy? (e.g. trunk-based, git-flow)
- Any project-specific forbidden patterns? (e.g. no service-role client in browser)

**Stage 4 — Testing Strategy**
- Target code coverage %?
- Which test framework? (e.g. Vitest, Jest, pytest)
- Which modules are highest risk and need test stubs first? (list them)
- Integration tests — real database or mocked?

**Stage 5 — Build & CI**
- Which CI provider? (GitHub Actions, GitLab CI, Bitbucket, etc.)
- What environments exist? (e.g. dev, staging, prod)
- Does every PR require CI to pass before merge — yes or no?
- Any deployment steps beyond build + test? (e.g. Docker push, migration run)

**Stage 6 — Deployment & Release**
- Where does this deploy? (platform, region)
- What is the rollback strategy if a deploy fails?
- Blue/green, canary, or rolling deploys — or standard replace?
- Are feature flags used for releases?

**Stage 7 — Observability & Operations**
- Which logging platform? (e.g. Datadog, CloudWatch, Loki, none)
- Which metrics/APM tool?
- What are the critical alerts that should wake someone up?
- Is there an on-call rotation, and who is in it?

**Stage 8 — Security**
- Which auth provider? (e.g. Auth0, Supabase Auth, custom JWT)
- Is there PII stored? If so, what fields and how is it protected?
- How are secrets managed? (e.g. AWS Secrets Manager, .env + vault, Doppler)
- Any compliance requirements? (SOC 2, GDPR, HIPAA, etc.)

**Stage 9 — Performance & Scale**
- What are the p95 latency targets per key endpoint?
- What is the expected peak concurrency?
- Which load testing tool? (e.g. k6, Locust, Artillery)
- Where is caching applied? (CDN, Redis, in-memory, none)

**Stage 10 — Data & Analytics Engineering**
- Which analytics or data warehouse platform? (e.g. BigQuery, Redshift, DuckDB, none)
- What events need to be tracked for product analytics?
- What is the data retention policy?
- Are there any PII fields in analytics that need masking?

---

## Step 5 — Create artifacts

Using only the information from Steps 3–4, create the required stage artifacts. Follow every rule in CLAUDE.md. Do not create files outside the agreed structure. Do not add features not mentioned.

---

## Step 6 — Gate evidence

After creating all artifacts, call `check_gate_status` for this stage. Show the gate checklist with a `file:line` citation for every satisfied criterion. List any criteria still unmet.

Tell the user: "Does this look right? Say **Stage $ARGUMENTS passed** to mark the gate, or tell me what to change."
