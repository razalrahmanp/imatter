---
name: sdlc-match-existing-style
description: Use before writing any new code in an existing codebase — calibrates naming, formatting, and patterns to the project's actual conventions instead of your defaults.
---

## Rule

Before writing code in a file or directory, read **20–30 lines of nearby existing code** in that same area. Match the style you find, even if you would write it differently in a fresh project.

## Precedence (highest wins)

1. **`CLAUDE.md` rules** — if a rule is documented, follow it even if local files violate it (file is wrong, not the rule).
2. **Existing file conventions** — naming, error handling, async style, comment density in the same file or nearby files.
3. **Project-wide conventions** — patterns repeated across many files (e.g., everything uses `kebab-case` for file names).
4. **Your personal preference** — only when 1–3 are silent.

## Checklist before writing

| Question | How to check |
|---|---|
| Naming convention (camelCase, snake_case, PascalCase)? | Scan adjacent file |
| Tabs or spaces? Indent width? | Look at any line |
| Single or double quotes? | Look at any string |
| Trailing commas? Semicolons? | Look at any block |
| Async style (callbacks, promises, async/await)? | Find any async function nearby |
| How are errors propagated (throw, return tuple, Result type)? | Find any error path nearby |
| Are comments doc-block style or single-line? | Find any commented function |
| Test file naming (`*.test.ts`, `*.spec.ts`, `__tests__/`)? | List the test directory |
| Import order (external first, then internal)? | Look at imports of 2 files |

## When this rule does not apply

- Starting a brand-new file in a brand-new project (no existing style to match)
- Existing style contradicts a documented `CLAUDE.md` rule — follow CLAUDE.md, then either fix or `log_open_item` for the violating files
- Migration in progress: an explicit decision (logged in Section 14) to change the convention — follow the new convention

## Anti-patterns

- ❌ Mixing four different async styles in one PR because "they all work"
- ❌ Introducing TypeScript strict-mode patterns in a project that has it disabled
- ❌ Adding JSDoc blocks in a codebase that uses inline `// comments`
- ❌ Naming a new file `userController.ts` when every other file is `user-controller.ts`

Everything else: match what you see.
