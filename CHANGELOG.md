# Changelog

All notable changes to the SDLC Validation plugin are documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
- **Patch** (`1.4.0 → 1.4.1`) — bug fixes and security patches. Always safe to apply. Auto-migration only.
- **Minor** (`1.4.0 → 1.5.0`) — new features. Backwards-compatible. Auto-migration handles all changes.
- **Major** (`1.x → 2.0`) — breaking changes. Migration script provided. See [MIGRATION.md](MIGRATION.md) for the philosophy and walkthroughs.

Every entry references the migration script (if any) and any manual steps required.

---

## [1.4.0] — 2026-05-20 — Region marker foundation

The upgrade contract is now real. This release ships the infrastructure required for external clients to upgrade without losing customisations or audit history.

### Added
- **Region marker system** — `SDLC_VALIDATION.md` is now tagged with `<!-- SDLC:start -->` / `<!-- SDLC:end -->` markers separating framework-owned content from user content.
  - Parser at `sdlc-mcp-server/src/regions.ts` with hash-based drift detection.
  - Template generator at `sdlc-mcp-server/src/template-generator.ts` produces canonical hashes per region.
  - Six modules total: `regions.ts`, `template-generator.ts`, `generate-template.ts`, `upgrade-check.ts`, `migration.ts`, `migrate.ts`.
- **`sdlc-upgrade-check` CLI** — pre-flight diff against installed framework version. Reports dirty regions and stale overrides without writing. Exit codes 0/1/2 for CI integration.
- **`sdlc-migrate` CLI** — applies migration scripts with backup-before-write. Supports `--check`, `--apply`, `--to=X.Y.Z`, `--rollback`, `--list-backups`. 30-day rollback retention.
- **Migration script framework** — versioned scripts in `sdlc-mcp-server/src/migrations/`. Each script receives a `ParseResult` and produces a new document. Verified parseable before commit.
- **First migration script**: `1.0.0 → 1.1.0` injects region markers into existing untagged documents.
- **First-class agent definitions** — four subagents in `plugin/agents/`:
  - `sdlc-gate-evidence-collector` (cross-stage)
  - `sdlc-spec-compliance-auditor` (Stage 1)
  - `sdlc-test-coverage-auditor` (Stage 4)
  - `sdlc-security-reviewer` (Stage 8)
- **Agent presets** in `plugin/agent-presets/` — drop-in JSON for `.sdlc-state.json` `stages.N.sub_agents[]`.
- **Routing documentation** at `docs/design/routing.md` — authoritative table of user intent → entry point.
- 39 new skill patterns added to the skill library (AWS, React, observability, security, testing, data, compliance). Total now 112.

### Changed
- Plugin manifest now exposes `plugin/agents/` to Claude Code via the `agents` field.
- README extensively updated with full plugin capabilities, SDLC context model, and CLI reference.

### Migration
- Apply with: `sdlc-migrate --apply`
- Auto-injects region markers, version stamp, and recomputes hashes.
- No manual steps required.
- Existing PASSED gates remain PASSED.
- User-edited framework regions are auto-wrapped as `user-override` blocks during migration.

### Files now generated at upgrade time
- `.sdlc-backups/<timestamp>/` — full backup of `SDLC_VALIDATION.md` and `.sdlc-state.json` before any write.

---

## [1.3.0] — 2026-05-20 — Multi-agent dispatch

### Added
- `sdlc_dispatch_agents` MCP tool — fan-out parallel sub-agent execution across all agents configured for the current stage.
- `sdlc_dispatch_status` MCP tool — read-only status query for in-flight agent dispatches.
- `sdlc-mcp-server/src/dispatch.ts` — dispatch record types and I/O for tracking parallel agent runs.

### Fixed
- Dispatch ID collision when the same stage is dispatched twice in close succession (deterministic suffix added).
- `sdlc-tag` reminder now fires after migrations that bootstrap previously untagged documents.

### Changed
- Stop hook output encoded as UTF-8 to fix Windows console corruption in session-log writes.

---

## [1.2.0] — 2026-05-20 — Guided workflow + CRLF fix

### Added
- `/sdlc-work N` skill — guided question-by-question workflow for each of the 10 SDLC stages. Each stage asks targeted questions and creates the required artefacts.
- Full command reference and workflow examples in README.

### Fixed
- CRLF line endings in `SDLC_VALIDATION.md` broke Quick Reference table parsing on Windows. Parser now normalises to LF.
- Stop-hook session log entry no longer requires user manual log on session end (auto-fires with placeholder content).

### Migration
- No manual steps.

---

## [1.1.0] — 2026-05-19 — Orchestration tools + CI audit

### Added
- `.sdlc-state.json` — machine-readable state file with cursor, history, stage configs, sub-agent findings, waivers, and HMAC integrity chain.
- Orchestration MCP tools: `sdlc_state_create`, `sdlc_init`, `sdlc_agent_write`, `sdlc_gate_run`, `sdlc_gate_waive`, `sdlc_signoff`, `sdlc_release_lock`, `sdlc_doctor`.
- Production coding tools: `sdlc_task_checkpoint`, `sdlc_error_diagnose`.
- Skills registry: `sdlc_skills_fetch` with layered resolution (compliance → project → stack → practice → generic).
- `sdlc-audit` CLI — CI-mode audit runner. JSON output, exit codes for pipeline gates.
- HMAC signing for state file with key auto-generated under `.sdlc/keys/state.key` (gitignored).
- Session locking via `.sdlc-state.lock` to prevent concurrent session corruption.

### Migration
- Run `sdlc_state_create` once per existing project to initialise `.sdlc-state.json` from the current SDLC document.
- HMAC key auto-generated.

---

## [1.0.0] — 2026-05-18 — Initial release

### Added
- Claude Code plugin with `marketplace.json`, MCP server, `SessionStart` and `Stop` hooks.
- Auto-load `SDLC_VALIDATION.md` Section 1 (project identity) and gate status on every session start.
- Auto-write `update_session_log` entry on session end.
- Initial MCP tools: `init_project`, `check_gate_status`, `get_project_identity`, `read_sdlc_section`, `load_sdlc_context`, `log_decision`, `log_open_item`, `update_session_log`, `verify_artifact`.
- Bundled `SDLC_VALIDATION.md` template with 10 stages + 2 cross-cutting concerns + protocol rules.
- Lazy context loading — surgical section reads instead of full-document loads at session start.
- `/sdlc-init`, `/sdlc-status`, `/sdlc-gate`, `/sdlc-load` skills.

---

## Versioning policy

### Patch versions
Released as needed. Always safe to apply. Examples:
- Bug fixes
- Security patches (CVEs)
- Documentation corrections
- Performance improvements with no observable behaviour change

### Minor versions
Released roughly monthly. Backwards-compatible. Examples:
- New MCP tools, agents, or skills
- New CLI subcommands or flags
- New stages or cross-cutting concerns added to the template (regions are added; existing ones are unchanged)
- New compliance modules

### Major versions
Released rarely (target: every 18–24 months). Breaking changes only. Examples:
- Removed or renamed MCP tools, agents, or skills
- Changed schema for `.sdlc-state.json`
- Changed format of `SDLC_VALIDATION.md` in a way the migration script cannot automatically resolve
- Removed or renamed CLI binaries

Every major release ships with:
- A migration script that handles the previous-minor → new-major transition.
- A dedicated section in [MIGRATION.md](MIGRATION.md) explaining philosophy, breaking changes, what's automatic, what needs manual review.
- 6 months of overlap support on the previous major version (security patches only).

### LTS releases
Every 4th minor version (e.g. v1.4, v1.8, v2.0) is designated **Long-Term Support** with 24-month patch support. Clients on LTS receive critical fixes for 2 years without being forced to take feature releases.

See [COMPATIBILITY.md](COMPATIBILITY.md) for the current support matrix.

---

## How to read this changelog

Each entry has:
- **Added** — new functionality (minor/major)
- **Changed** — behaviour changes for existing functionality (minor for additive; major for breaking)
- **Deprecated** — features marked for removal (typically one minor version before removal)
- **Removed** — features removed (major only)
- **Fixed** — bug fixes (patch)
- **Security** — security patches (patch)
- **Migration** — what's required to upgrade from the previous version

Entries link to migration scripts and any manual steps required. **If an entry has no `Migration` block, the upgrade is fully automatic.**
