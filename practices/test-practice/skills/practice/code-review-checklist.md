---
id: code-review-checklist
title: "Code review checklist — correctness, security, style, test coverage"
layer: practice
tags: [code-review, checklist, pr, quality, security]
applies_to:
  task_types: [any]
  stages: [5, 7]
size_tokens: 200
related: [pr-description-template, refactoring-safety, testing-strategy]
---

# code-review-checklist — Code Review Checklist

## Pattern Summary

Use this checklist as the reviewer, not the author. Each item is a gate — don't approve until you can check it.

**Correctness:**
```
□ Does the code do what the PR description says?
□ Are edge cases handled (empty list, null, zero, max value)?
□ Are concurrent writes safe (race conditions, TOCTOU)?
□ Is error handling present for every external call?
□ Are database operations transactional where they need to be?
```

**Security:**
```
□ No user-controlled input reaches a query, shell command, or eval without sanitisation
□ No secrets, credentials, or PII in code or logs
□ Auth/authz checks present before any data access
□ No new npm/pip/go dependency without licence + CVE check
□ No new external network endpoint without documented purpose
```

**Test coverage:**
```
□ Happy path covered
□ At least one error/failure case covered
□ If a bug fix: regression test that would have caught the original bug
□ No tests deleted without explicit justification
```

**Style and maintainability:**
```
□ Names are clear without needing comments to explain them
□ No dead code (commented-out blocks, unused variables)
□ No TODO left without a tracking issue reference
□ Function length reasonable — can you understand it in one read?
```

## Full Reference

### When to block vs comment
Block (request changes): correctness bugs, security issues, missing tests for critical paths, breaking API contracts.
Comment (non-blocking): style preferences, alternative approaches, questions. Prefix with `nit:` or `q:` so author knows it's not a blocker.

### Self-review first
Authors should run the checklist on their own PR before requesting review. The review should be a second pair of eyes, not the first.
