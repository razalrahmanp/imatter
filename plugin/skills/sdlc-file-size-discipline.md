---
name: sdlc-file-size-discipline
description: Use before editing or creating any source file — enforces a 300-line hard cap and gives the splitting strategy when a file grows past it.
---

## Rule

No source file exceeds **300 lines**. When a file would cross that line, split it before you write more.

## Before editing

```bash
wc -l <file>
```

- Under 250 lines → safe, edit freely.
- 250–299 lines → write the edit, then evaluate if a split is now warranted.
- 300+ lines → split first, then edit.

## Splitting strategy (in this order)

1. **By responsibility** — does the file mix two distinct concerns? Split into one file per concern.
   - Example: `user.ts` containing auth logic + DB queries + serialization → `user-auth.ts` + `user-repo.ts` + `user-serializer.ts`.

2. **By feature cluster** — does the file contain N small variations of the same thing? Group them.
   - Example: `validators.ts` with 30 schema definitions → `validators/user.ts`, `validators/order.ts`, `validators/payment.ts`.

3. **By type** — if responsibility and clustering both fail, separate types from logic.
   - Example: `payment.ts` (600 lines mixed) → `payment-types.ts` + `payment.ts`.

## What does not count toward the 300

- License headers and top-of-file comment blocks
- Import statements
- Generated code (mark with `// generated — do not edit`)
- Test fixtures that are pure data (consider a `fixtures/` dir anyway)

## Why the cap matters

- A file over 300 lines is harder to hold in working memory
- Diff review fatigue rises sharply past that point
- File-level locks and merge conflicts get expensive
- Encourages clear single-purpose modules

## When this rule does not apply

- Auto-generated files (protobuf, GraphQL types, ORM models) — leave them alone
- Configuration files (`package.json`, lockfiles, `tsconfig.json`) — no cap
- Markdown documentation — no cap (split for reader comfort, not the limit)

Everything else: cap at 300.
