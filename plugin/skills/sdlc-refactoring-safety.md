---
name: sdlc-refactoring-safety
description: Use when undertaking any non-trivial refactor — covers the moves that keep refactors safe (separating mechanical changes from behavior changes, characterization tests, small commits).
---

## Rule

A safe refactor changes structure without changing behavior. Separate the moves: write characterization tests of current behavior first, then refactor in small commits, each of which keeps tests green. Behavior changes are *not* refactors — they're features or bug fixes.

## The two-pass rule

1. **Pass 1 — Characterize**: Write tests that capture current behavior (warts included). These pass before you change anything.
2. **Pass 2 — Restructure**: Move code around. After each commit, all tests still green.

If a characterization test starts failing, you've changed behavior. Either revert or convert to an explicit behavior change with a different commit.

## Small commits

Each commit:
- Compiles
- Passes all tests
- Does one thing (extract function, rename, inline, move file)

If the team uses squash-merge, internal commits stay; the final history shows one PR. But during the work, small commits make bisecting and reverting cheap.

## Common safe moves

| Move | What | Risk |
|---|---|---|
| **Rename** | Variable / function / class name | Low — IDE refactor + tests |
| **Extract function** | Pull a block into a named function | Low — IDE refactor + tests |
| **Inline** | Replace function call with body | Low — IDE refactor + tests |
| **Move file** | Same content, new path | Medium — fix imports; CI catches misses |
| **Extract type/interface** | Pull duplicate shapes into a type | Low |
| **Replace conditional with polymorphism** | Strategy pattern | Higher — characterization tests essential |
| **Replace inheritance with composition** | Refactor classes | High — needs full test coverage |

## Behavior changes that ARE NOT refactors (do separately)

- Changing what an API returns
- Changing what's logged or its level
- Changing error messages users see
- Changing default values
- Changing failure modes (throw → return null, etc.)

If you have to do these, separate commit/PR with explicit description. Don't sneak them into a "refactor PR" — reviewer trust is at stake.

## Anti-patterns

- ❌ "Refactor while I'm here" sneaking unrelated changes into a feature PR (see [[sdlc-surgical-changes]])
- ❌ A single huge "cleanup" PR (impossible to review, impossible to revert cleanly)
- ❌ Refactor without test coverage of the affected code (no safety net)
- ❌ Refactoring + bumping deps + changing CI in one PR (multiple risk factors compounded)
- ❌ "It still compiles" treated as safety (compilation ≠ correctness)
- ❌ Reformatting an entire file as part of a meaningful change (the diff is now unreviewable)

## Gate criteria

- Characterization tests added or confirmed before any non-trivial refactor
- Refactor PR contains only refactoring — no behavior changes
- Each commit in the PR compiles and passes tests
- Reviewer can read the diff and see "structure changed, behavior didn't"
- PRs labeled as `refactor` follow this checklist
