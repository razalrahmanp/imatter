---
id: changelog-pattern
title: "Changelog pattern — Keep a Changelog format, semantic versioning"
layer: practice
tags: [changelog, semver, release, documentation, versioning]
applies_to:
  task_types: [any]
  stages: [7, 10]
size_tokens: 185
related: [commit-message-convention, pr-description-template, api-doc-pattern]
---

# changelog-pattern — Changelog Pattern

## Pattern Summary

Keep a CHANGELOG.md following the Keep a Changelog format. It is written for humans (not generated from git log). Each release entry answers: what changed and does this affect me?

**CHANGELOG.md structure:**
```markdown
# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com). Versioning: [SemVer](https://semver.org).

## [Unreleased]
Changes staged for the next release.

### Added
- Bulk order cancel endpoint — cancel up to 50 orders in one request

### Changed
- Order history now returns cursor-based pagination (breaking for clients using `offset` param)

### Fixed
- Fixed race condition in payment capture that caused duplicate charges

### Deprecated
- `GET /orders?offset=N` deprecated — use `GET /orders?after=<cursor>` instead. Removed 2026-09-01.

### Removed
### Security

---

## [1.4.0] — 2026-05-15

### Added
- ...

[Unreleased]: https://github.com/org/repo/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/org/repo/compare/v1.3.0...v1.4.0
```

**Semver rules:**
```
PATCH (1.4.x): bug fix, no API change
MINOR (1.x.0): new feature, backward-compatible API addition
MAJOR (x.0.0): breaking change to public API or behavior
```

## Full Reference

### Unreleased section discipline
Every merged PR that changes user-visible behavior gets an entry in `[Unreleased]` immediately on merge, not at release time. At release: rename `[Unreleased]` to the new version, create a new empty `[Unreleased]`.

### What NOT to include
Internal refactors, dependency bumps (unless they affect public behavior), test-only changes. The changelog is for consumers, not contributors.
