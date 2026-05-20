---
id: refactoring-safety
title: "Refactoring safety — test first, small steps, no behavior change"
layer: practice
tags: [refactoring, safety, tests, incremental, clean-code]
applies_to:
  task_types: [refactor, modify-handler, modify-component]
  stages: [5, 7]
size_tokens: 195
related: [code-review-checklist, testing-strategy, tech-debt-tracking]
---

# refactoring-safety — Refactoring Safety Pattern

## Pattern Summary

A refactor changes structure without changing behavior. If you cannot verify behavior is unchanged, you are not refactoring — you are rewriting. Rewrites need a different risk management approach.

**Pre-refactor checklist:**
```
□ Test coverage exists for the code you are refactoring
   → If not: write characterisation tests first, THEN refactor
□ You understand the current behavior, including edge cases
□ The refactor scope is defined — what files/functions are in scope?
□ You have a rollback plan (feature flag or revert strategy)
```

**Safe refactoring steps:**
```
1. Run tests — establish green baseline
2. Make ONE structural change (rename, extract, inline, move)
3. Run tests again — must still be green
4. Commit (small commits = easy bisect if something breaks)
5. Repeat
```

**Characterisation tests (when test coverage is missing):**
```typescript
// Before refactoring legacy code with no tests:
// Write tests that capture CURRENT behavior — even if the behavior seems wrong
test("legacy calculateFee returns 0 for zero amount", () => {
  expect(calculateFee(0)).toBe(0); // current behavior
});
test("legacy calculateFee rounds up to nearest rupee", () => {
  expect(calculateFee(10.5)).toBe(11); // current behavior — document it
});
// Now refactor. If tests break, you changed behavior — stop and investigate.
```

## Full Reference

### Refactor vs rewrite decision
If > 50% of the function/module logic changes, call it a rewrite. Rewrites get a separate PR, a feature flag for gradual rollout, and a rollback plan.

### Common refactoring mistakes
- Mixing refactor with bug fix in one commit — impossible to bisect if the bug fix breaks something
- Extracting a helper and simultaneously changing its behavior
- Renaming a public API without a deprecation path

### Forbidden
- Combining a refactor with a behavior change in the same commit
- Refactoring without any test coverage (green/red/green is the only way to know if you changed behavior)
