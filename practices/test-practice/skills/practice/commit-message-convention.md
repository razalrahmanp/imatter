---
id: commit-message-convention
title: "Commit message convention — Conventional Commits, scope, body rules"
layer: practice
tags: [git, commit, conventional-commits, changelog, ci]
applies_to:
  task_types: [any]
  stages: [5, 7]
size_tokens: 195
related: [changelog-pattern, pr-description-template]
---

# commit-message-convention — Commit Message Convention

## Pattern Summary

Use Conventional Commits. Machines parse the type for changelogs and version bumps. Humans read the subject for blame/log navigation.

**Format:**
```
<type>(<scope>): <subject>

[optional body]

[optional footer: BREAKING CHANGE, Closes #123]
```

**Types:**
```
feat      — new feature (triggers MINOR version bump)
fix       — bug fix (triggers PATCH)
chore     — maintenance, dependency update, config (no version bump)
refactor  — code change that neither fixes a bug nor adds a feature
test      — adding or correcting tests
docs      — documentation only
perf      — performance improvement
ci        — CI/CD pipeline changes
build     — build system, tooling
```

**Scope (optional, project-specific):**
```
feat(orders): add bulk cancel endpoint
fix(auth): handle expired token on WebSocket upgrade
chore(deps): bump zod to 3.22.4
```

**Subject rules:**
- Imperative mood: "add", "fix", "remove" — not "added", "fixes", "removed"
- No capital first letter
- No period at end
- ≤ 72 characters

**Body (when to use):**
Include body when the WHY is non-obvious: a workaround for a known bug, a counterintuitive approach, a performance trade-off. Skip if the subject is self-explanatory.

**Breaking changes:**
```
feat(api)!: rename /orders/cancel to /orders/{id}/cancel

BREAKING CHANGE: clients must update endpoint path. Old path returns 410.
```

## Full Reference

### BREAKING CHANGE triggers MAJOR bump
The `!` suffix after type or `BREAKING CHANGE:` footer both trigger a major version increment in semantic-release / standard-version tooling.

### Squash merge discipline
When squash-merging a PR, the squash commit message becomes the Conventional Commit. Set it before merging — don't inherit the default "Merge PR #123" message.
