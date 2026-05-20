---
id: pr-description-template
title: "PR description template — summary, test plan, screenshots, reviewer notes"
layer: practice
tags: [pr, pull-request, review, documentation, workflow]
applies_to:
  task_types: [any]
  stages: [5, 7]
size_tokens: 190
related: [code-review-checklist, commit-message-convention, changelog-pattern]
---

# pr-description-template — Pull Request Description Template

## Pattern Summary

A good PR description tells reviewers what changed, why, and how to verify it — so they don't have to reverse-engineer it from the diff.

**Template:**
```markdown
## What

One paragraph. What does this PR do? Focus on the user-visible or system-visible change,
not the implementation. "Adds a bulk cancel endpoint that lets owners cancel up to 50
orders in a single request" — not "adds a handler function with a loop."

## Why

Why is this change needed now? Link to the issue/ticket driving it.
If there's no ticket, explain the motivation briefly.

Closes #<issue>

## How (if non-obvious)

Only include this section if the implementation approach is surprising or worth explaining.
Skip if the code is self-explanatory.

## Test plan

- [ ] Unit tests cover the new logic (link CI run)
- [ ] Manual test: describe the steps you followed to verify the happy path
- [ ] Manual test: describe the error/edge case you tested
- [ ] Staging deploy verified (if applicable)

## Screenshots / recordings (UI changes only)

Before: [image]
After:  [image]

## Reviewer notes

Flag anything you want extra attention on: a trade-off you made, an area of uncertainty,
code you're not sure about. This focuses reviewer energy where it's most useful.
```

## Full Reference

### What NOT to include
- Full diff summary ("changed X, Y, Z") — the reviewer can see the diff
- Apologies for the PR size — split the PR instead
- Placeholder "WIP" notes in a PR ready for review

### Draft PRs
Use GitHub Draft PRs for work-in-progress that needs early feedback. Clearly state in the description what feedback is wanted at the draft stage.
