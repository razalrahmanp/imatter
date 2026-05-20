# Contributing Skills

## What is a skill?

A skill is a short, opinionated reference for a single engineering pattern. It has two purposes:
1. **Pattern summary** (~200 tokens) — injected into a writer agent's context before coding
2. **Full reference** — browsed by engineers, not injected into AI context

`sdlc_skills_fetch` returns only the Pattern Summary section. The rest is for humans.

## Registry layout

```
skills/
├── generic/               # Stack-agnostic, region-agnostic — valid for any project
├── practice/              # Engineering-process patterns (not code patterns)
├── stack/{stack-id}/      # Stack-specific code patterns
├── project/{project-id}/  # Project-specific business logic
├── compliance/{module}/   # Loaded per compliance module declared in .sdlc-stack.json
└── CONTRIBUTING.md        # This file
```

**Layer resolution order** (highest priority first):
```
compliance → project → stack → practice → generic → flat (legacy)
```

When `sdlc_skills_fetch` looks for `lambda-worker`, it checks each layer in order and returns the first match.
A stack-specific `lambda-worker` overrides a generic one. A project overlay overrides both.

## Skill file format

Every skill file follows this exact structure:

```markdown
---
id: skill-id-kebab-case
title: "Short title — what this skill covers"
layer: generic | practice | stack | project | compliance
stack: react-supabase-lambda          # required if layer=stack
project: rabos                         # required if layer=project
compliance_module: gdpr                # required if layer=compliance
tags: [tag1, tag2, tag3]              # used for filtering; keep to 4–6 per skill
applies_to:
  task_types: [add-handler, modify-handler]   # task slugs that trigger this skill
  stages: [3, 5, 7]                           # SDLC stages where this skill applies
size_tokens: 220                       # approximate token count of Pattern Summary
related: [other-skill-id, another-id]  # sibling skills worth fetching together
---

# skill-id — Full Title

## Pattern Summary

[200-token compressed summary. This section is what sdlc_skills_fetch returns.
Code blocks are fine but keep them short — one canonical example, not five variations.
Lead with the rule, then show the code, then state what's forbidden.]

## Full Reference

[Detailed examples, edge cases, configuration options.
Engineers read this; AI agents do not.]

## When NOT to use

[Anti-patterns, alternatives to consider, edge cases where this pattern breaks down.]
```

## Writing rules

**Pattern Summary must:**
- Fit in ~200 tokens (roughly 800 characters)
- Start with the invariant rule, not background ("All DB queries use `withRls`. Never use the bare pool.")
- Show ONE canonical code example — the correct form
- End with a "Forbidden" or "Never do" list if there are common wrong patterns
- Not reference this project's specific table names or domain concepts (generic/practice layers)

**Tags:**
- 4–6 tags per skill
- Use existing tags when possible — check other skills in the same layer
- Technology tags: `aws`, `postgresql`, `react`, `typescript`, `python`, `go`
- Concern tags: `security`, `observability`, `performance`, `testing`, `reliability`
- Pattern tags: `auth`, `validation`, `caching`, `logging`, `database`, `api`

**`applies_to.task_types`** (use these slugs):
- `add-endpoint`, `modify-endpoint` — HTTP handler work
- `add-handler`, `modify-handler` — Lambda handler work
- `add-worker`, `modify-worker` — async worker / SQS consumer
- `add-migration`, `modify-schema`, `add-table`, `add-column` — DB schema work
- `add-component`, `modify-component` — frontend UI work
- `add-ai-call`, `modify-llm-call` — Bedrock / LLM integration
- `add-query` — DB query work without schema change
- `all` — applies to every task type (use sparingly)

## Adding a new skill

1. Decide the layer: generic → practice → stack → project → compliance
2. Pick an `id`: kebab-case, unique within the registry
3. Copy the template above, fill every frontmatter field
4. Write the Pattern Summary: rule → code example → forbidden list
5. Test: `sdlc skills <id>` should print the Pattern Summary correctly
6. Submit PR; CI validates frontmatter schema

## Updating an existing skill

- Changing Pattern Summary: keep `size_tokens` accurate (chars / 4 ≈ tokens)
- Adding a new example: put it in Full Reference, not Pattern Summary
- Changing tags: check that no automated task routing depends on the old tags

## Adding a new stack profile

Create `skills/stack/{stack-id}/` and add a `README.md` describing the stack.
At minimum, implement: `api-endpoint`, `database-query`, `worker-pattern`, `auth-pattern`.
These four are expected by the orchestrator for every stack profile.
