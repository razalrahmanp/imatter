---
id: readme-structure
title: "README structure — purpose, quickstart, architecture, contributing"
layer: practice
tags: [readme, documentation, onboarding, developer-experience]
applies_to:
  task_types: [any]
  stages: [1, 2]
size_tokens: 185
related: [architecture-doc, api-doc-pattern, changelog-pattern]
---

# readme-structure — README Structure Pattern

## Pattern Summary

A README answers four questions in order: what is this, how do I run it, how does it work, how do I contribute. Anything else goes elsewhere.

**Required sections:**
```markdown
# <Project name>

One sentence. What does this system do and for whom?

## Quickstart

The minimum steps to get a working local environment.
A new engineer should be able to run this in < 15 minutes.

\`\`\`bash
cp .env.example .env
npm install
npm run db:migrate
npm run dev
\`\`\`

Localhost URL: http://localhost:3000
Default credentials: see .env.example comments

## Architecture

Brief (3–5 sentences) or a diagram. What are the main components and how do they connect?
Link to deeper docs (ADRs, architecture doc) for detail.

## Key concepts (optional — add if the domain is non-obvious)

Glossary of domain terms a new engineer needs to understand the codebase.

## Development

- Test: `npm test`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Build: `npm run build`

## Contributing

Link to CONTRIBUTING.md. Summarise: branch naming, PR process, review requirements.

## License

SPDX identifier or "Private and confidential."
```

## Full Reference

### What NOT to put in README
- Full API reference (use api-doc-pattern / OpenAPI)
- Operational runbooks (use runbook-pattern)
- Decision rationale (use decision-record / ADRs)
- Exhaustive configuration reference (use .env.example comments)

### Freshness rule
If a README section is more than 3 months stale, it is misleading. Either update it or remove it. A missing section is better than a wrong section.
