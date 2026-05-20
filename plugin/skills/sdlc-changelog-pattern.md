---
name: sdlc-changelog-pattern
description: Use when releasing any versioned software — produces a CHANGELOG that's useful to upgraders, matched to semver, and easy to keep current with each release.
---

## Rule

A CHANGELOG is for *humans upgrading*. It tells them what to do — what's new, what to migrate, what broke. It is grouped by release, ordered newest first, and uses a fixed vocabulary. Never auto-generated from git log alone — that's noise.

## Format — Keep a Changelog + SemVer

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Webhook signature verification for incoming events.

### Changed
- Default rate limit raised from 60 to 300 requests/minute.

### Deprecated
- `/v1/users` endpoint — use `/v2/users`. Will be removed in v3.0.

### Removed
- Legacy `/health-check` endpoint (use `/healthz`).

### Fixed
- Race condition in webhook deduplication.

### Security
- Updated dependency X to address CVE-YYYY-NNNN.

## [2.4.0] - 2026-05-15

### Added
- Multi-tenant export feature.

### Fixed
- Pagination cursor handling on empty result sets.

## [2.3.1] - 2026-05-08

### Security
- Patched XSS in admin search UI.

## [2.3.0] - 2026-04-30

...
```

## Fixed vocabulary — six categories only

| Category | What |
|---|---|
| **Added** | New features visible to users |
| **Changed** | Behavior changes (NOT bug fixes) |
| **Deprecated** | Features still working but going away |
| **Removed** | Features gone |
| **Fixed** | Bugs fixed |
| **Security** | Security-relevant changes (sometimes also tracked separately in SECURITY.md) |

Don't invent new categories. Don't merge into one big list.

## SemVer mapping

| Version bump | When |
|---|---|
| **MAJOR (1.0 → 2.0)** | Breaking change — anything in `Removed`, breaking changes in `Changed` |
| **MINOR (2.4 → 2.5)** | Non-breaking new feature — additions to `Added` |
| **PATCH (2.5.0 → 2.5.1)** | Bug fix / security patch — `Fixed`, `Security` |

If you have only `Fixed` entries: patch bump. If you have `Added` (but no breaking `Changed`/`Removed`): minor bump. Any breaking entry: major bump.

## When to update

| Approach | How |
|---|---|
| **Per-PR** | Every PR adds its line(s) under `[Unreleased]` |
| **At release time** | Maintainer assembles from PRs / commits before tagging |
| **Hybrid** | PR adds to Unreleased; release moves Unreleased → versioned section |

For most teams: per-PR. The unreleased section grows; at release, you bump version, datestamp it, start fresh.

## Tooling

- `changesets` (JS): each PR adds a markdown fragment; release combines them
- `git-cliff` / `conventional-changelog`: generates from conventional-commit messages
- Manual editing of CHANGELOG.md: simplest, most curated

For libraries published to npm/PyPI: invest in tooling. For internal tools: manual is fine.

## What goes in vs what stays out

| In | Out |
|---|---|
| User-facing additions | Internal refactors |
| Behavior changes users would notice | Test improvements |
| Breaking changes (always) | Doc-only changes (unless docs are the product) |
| Bug fixes users could have hit | Internal bug fixes for impossible states |
| Security patches (always, even tiny) | CI/build tooling changes |
| Performance changes users will notice | Cosmetic refactors |

Quality > exhaustiveness. A 5-entry changelog with the things users care about beats a 50-entry dump.

## Anti-patterns

- ❌ Auto-generated from git log with no curation (50 commits → 50 lines, mostly noise)
- ❌ One line per release: "Various improvements"
- ❌ Free-form categories every release ("Improvements", "Tweaks", "Updates")
- ❌ Updating CHANGELOG at release time only (loses context; entries are vague)
- ❌ Internal-only items leaking ("Refactored OrdersService" — users don't care)
- ❌ Breaking changes hidden in "Changed" without a migration note
- ❌ Different format than what users expect from the ecosystem

## Migration notes

For breaking changes, include a migration block:

```markdown
## [3.0.0] - 2026-08-01

### Removed
- `/v1/users` endpoint. Use `/v2/users`.

### Migration
- Update API client to use `/v2/users`. Response shape changed: `name` field split into `first_name` + `last_name`.
- See [migration guide](docs/migrations/v3.md) for the full diff.
```

## Gate criteria

- A `CHANGELOG.md` exists at the repo root, following the Keep a Changelog format
- Every release version has a section with date
- Each entry is in one of the six fixed categories
- Breaking changes always have a migration note
- The PR template references CHANGELOG; releases verify it was updated
- For public packages: the changelog is the source for release notes, not separately written
