---
name: sdlc-commit-message-convention
description: Use when writing any commit message — defines the format, the rules, and the rationale so commit history stays useful for future readers and automated tooling.
---

## Rule

Every commit message follows a single convention. Subject line is short, imperative, and stands alone. Body explains *why*, not *what*. Trailers carry machine-readable metadata. Co-authorship is honest.

## Convention — Conventional Commits + body

```
<type>(<optional scope>): <imperative short subject under 72 chars>

<optional body — explains the WHY, wraps at 72 chars>

<optional trailers>
```

### Type prefix — pick one

| Type | Use for |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code restructure with no functional change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests only |
| `docs` | Documentation only |
| `style` | Formatting/whitespace; no logic change |
| `build` | Build system / dependencies |
| `ci` | CI configuration |
| `chore` | Maintenance not covered above |
| `revert` | Reverting a prior commit |

### Examples

```
feat(orders): allow customers to cancel within 30 minutes of placing

Customers can now cancel orders via the order detail page if the order
status is "pending" and was placed less than 30 minutes ago. After that
window, orders proceed to fulfillment and cancellation requires support.

This addresses the most common support ticket category from Q1.

Closes #1234
```

```
fix(auth): close session table connection on logout

`req.session.destroy` was leaking a Postgres connection because the
async callback wasn't awaited. Under load this exhausted the pool after
~6 hours, causing intermittent 500s on /auth/login.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

```
docs: clarify rate-limit headers section in API guide
```

## Subject line rules

| Rule | Why |
|---|---|
| ≤ 72 characters (50 is better) | GitHub truncates at ~72 |
| Imperative mood ("add" not "added" or "adds") | Reads consistently in `git log` |
| No trailing period | Convention |
| Lowercase after the type/scope | Convention |
| Don't repeat the type ("fix(auth): fix bug") | Redundant |

## Body — when to write one

Always write a body if:
- The change is non-trivial (more than ~10 lines)
- The *reason* isn't obvious from the diff
- There's a tricky tradeoff that future-you should know about
- The fix relates to an incident or specific reported issue

Skip the body for:
- Pure typo fixes
- Trivial refactors
- One-line bumps

## Trailers — machine-readable metadata

Trailers are at the bottom, separated by a blank line, in `Key: Value` format:

| Trailer | Use |
|---|---|
| `Co-Authored-By: Name <email>` | Pair programming, AI assistance |
| `Closes #123` / `Fixes #123` | Auto-closes GitHub issue on merge |
| `Refs #123` | Related, doesn't close |
| `Reviewed-By: Name <email>` | Manual review credit |
| `Signed-Off-By: Name <email>` | DCO compliance |
| `BREAKING CHANGE: <description>` | Triggers major version bump in semver tools |

## AI attribution

If Claude Code (or any AI assistant) co-authored the change, attribute:

```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

This is enforced by a PostToolUse hook in `.claude/settings.json` and required by [CLAUDE.md](../../CLAUDE.md) at the repo root.

## Anti-patterns

- ❌ Subject: `"fix"` or `"update"` or `"misc"` — useless to future readers
- ❌ Subject longer than the body
- ❌ "wip" or "draft" commits merged to main (squash or rewrite before merge)
- ❌ Past tense / passive voice ("Fixed the bug that was broken")
- ❌ Putting the *what* in the body when the diff already shows it
- ❌ One mega-commit with a dozen unrelated changes (split into atomic commits)
- ❌ Bypassing hooks with `--no-verify` to skip attribution / linting
- ❌ Force-pushing rewritten history to a shared branch (rewrite on your own branch, then push normally on PR)

## Tooling

- `commitizen` / `cz-cli` — interactive commit message builder
- `commitlint` + Husky pre-commit hook — enforce format on commit
- GitHub Action checking commit messages on PRs

## Gate criteria

- A `.gitmessage` template exists at the repo root and is set as `commit.template`
- A commit-message linter runs on PRs (or pre-commit hook locally)
- Commits without AI attribution are flagged when Claude Code helped (per repo policy)
- Subject lines stay under 72 chars (CI check)
- The first 10 commits in `git log --oneline` are readable and informative to a stranger
