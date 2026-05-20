# Migration Guide

How to upgrade SDLC Validation between framework versions without losing your customisations, history, or PASSED gates.

For day-to-day patch and minor upgrades, see the `Migration` block in each [CHANGELOG.md](CHANGELOG.md) entry. This document covers:

- **The five guarantees** clients can rely on across any upgrade.
- **The mechanics** — what happens when you run `sdlc-migrate --apply`.
- **Major version walkthroughs** — what changes and what you need to do.
- **When you cannot upgrade right now** — security-only mode, audit windows, LTS.

---

## The five guarantees

When you upgrade SDLC Validation, the framework promises:

### 1. Your PASSED stages remain PASSED across upgrades
A stage only loses PASSED status if a specific criterion that was checked at PASS time has changed. The upgrade reports exactly which criterion, and re-auditing that single criterion restores PASSED. You don't re-run the whole stage.

### 2. Your customisations to SDLC_VALIDATION.md survive every upgrade
Anything you wrote in `user` regions persists forever. Anything you edited inside `framework` regions is wrapped automatically as a `user-override` block — your text wins for your project, but you'll see a notice if the framework's canonical version of that region changes underneath.

### 3. Your custom skills, gates, and compliance modules continue working
The plugin interface is stable across minor versions. If a breaking change is needed (major version), we ship a codemod that updates your custom artefacts to the new interface.

### 4. Migrations are reversible for 30 days
Run `sdlc-migrate --rollback` within 30 days and you're back to where you were, with full state restored from `.sdlc-backups/`.

### 5. You can pin and skip
If a release doesn't work for your project, pin to the previous version and skip it. The next release's migration script handles the longer transition directly. No forced incremental upgrade chain.

These guarantees are the framework's contract. If you ever see one broken, file an issue — it's a bug, not a feature.

---

## What happens when you run `sdlc-migrate --apply`

```
1. Detect the client document's version
   Reads <!-- SDLC:version "X.Y.Z" --> from SDLC_VALIDATION.md, or
   falls back to .sdlc-state.json's sdlc_framework_version, or
   assumes 1.0.0 if nothing is found.

2. Detect the installed framework version
   Reads plugin/template/registry.json → version field.

3. Compute the upgrade path
   All migration scripts in src/migrations/ are ordered by target version.
   Applicable subset = scripts where:
     fromVersion < script.to ≤ targetVersion

4. Back up before any write
   Copy SDLC_VALIDATION.md and .sdlc-state.json into
   .sdlc-backups/<ISO-timestamp>/

5. Run each migration in order
   Each script:
     - parses the current document with parseRegions()
     - calls apply(ctx) to produce a new document
     - is validated by re-parsing the output (aborts if new parse errors appear)
     - hands its output to the next script

6. Write the final document atomically
   Only after all scripts succeed does the live SDLC_VALIDATION.md get
   overwritten.

7. Detect unauthorised edits
   Any framework region whose content hash differs from the registry
   canonical hash is flagged. Migration auto-wraps these as user-override
   blocks — your edits win, but you'll see a stale-override warning if
   the framework updates the same region later.
```

If any step fails, the live file is untouched and the backup is preserved.

---

## Major version walkthroughs

Each major release has its own section here. Read the section for the version you're upgrading **to**, plus every intermediate major version if you're skipping.

---

### 1.x → 2.0 (not yet released)

This section will be filled in when v2.0 ships. Expected breaking changes under consideration:

- Skill schema migration from v1 to v2 (frontmatter changes; codemod will auto-convert).
- `.sdlc-state.json` schema refresh (cursor and history merged; auto-migration).
- Removal of legacy `sdlc-tag` CLI now that `sdlc-migrate` covers the same surface area.

Any v1.x project will be upgradable to v2.0 via a single `sdlc-migrate --apply` command. No skill-by-skill manual conversion required.

---

### 0.x → 1.0 (historical)

The plugin shipped at v1.0 as its first stable release. No 0.x to migrate from.

---

## When you cannot upgrade right now

Some projects cannot take a feature release for a while. Examples:

- Mid-compliance audit (auditor has reviewed your `SDLC_VALIDATION.md` at v1.0.0; changing it mid-audit invalidates the review).
- Regulated freeze period (PCI quarterly assessment, SOC 2 audit window).
- Legacy support contract — security patches only.

The framework handles these cases:

### Security-only mode

```bash
sdlc-migrate --apply --security-only
```

Applies only critical security patches. No feature changes. No schema migrations. No doc regeneration. Even on a project pinned to v1.0.0, a CVE patch (v1.0.0 → v1.0.1.security) gets applied.

> Note: `--security-only` flag is planned for v1.5 — until then, pin to the patch release directly.

### Dry-run timeline

```bash
sdlc-migrate --check --to=1.5.0
```

Shows what upgrades become available between now and a future target version. Use this to plan around audit windows.

### LTS releases

Every 4th minor version (v1.4, v1.8, v2.0) is **Long-Term Support** with 24-month patch support. Clients on LTS get critical fixes for 2 years without being forced to take feature releases. Pin to an LTS version if your project cannot afford continuous upgrades.

See [COMPATIBILITY.md](COMPATIBILITY.md) for the current LTS status of each version.

---

## Region marker primer

If you're upgrading from v1.0.x (untagged) to v1.1+ (tagged), the migration is a one-time event: region markers get injected into your `SDLC_VALIDATION.md`. After that, every subsequent upgrade is incremental.

Three region types exist:

| Type | Owner | What happens on upgrade |
|---|---|---|
| `framework` | The framework | Content replaced with new canonical. Hash recomputed. |
| `user` | You | Content never touched. Migration ignores it. |
| `user-override` | You (was framework) | Content preserved. Flagged as "stale" if the framework's version of the same region updates. |

Section 0 (Protocol Rules), the stage gate criteria, and the Quick Reference table are `framework` regions — the framework owns them and they update on each release.

Section 15 (Decision Log), 16 (Open Items), 17 (Known Gaps), 18 (Session Log) are split: the table header is `framework`, the data rows are `user`. You can add rows freely; the framework only updates the schema.

Custom gate criteria you add live in `user` regions named `stage-N-custom` that sit immediately after each stage's framework region. Migration never touches them.

---

## Recovering from a bad upgrade

If something goes wrong:

```bash
# 1. List available restore points
sdlc-migrate --list-backups

# 2. Roll back to the most recent
sdlc-migrate --rollback

# 3. Or roll back to a specific timestamp
sdlc-migrate --rollback=2026-05-20T14-22-00
```

Rollback creates its own pre-rollback backup, so the rollback is itself reversible.

If the backup is older than 30 days, rollback refuses (the file might have legitimate user edits since then). At that point, you have two options:

1. **Selective restore** — copy specific files out of `.sdlc-backups/<timestamp>/` manually.
2. **Manual reconstruction** — use the backup as reference and re-tag with `sdlc-tag`.

---

## Custom plugin compatibility

If you maintain custom skills, compliance modules, or stack profiles in your project's `skills/` directory, here's what to expect on a framework upgrade:

| Change category | What happens |
|---|---|
| Patch (X.Y.Z → X.Y.Z+1) | No impact on custom artefacts. Always safe. |
| Minor (X.Y.0 → X.Y+1.0) | Custom artefacts continue working unchanged. New framework artefacts appear alongside yours. |
| Major (X → X+1) | Codemod runs against your custom artefacts to update them to the new interface. Review the codemod's output before committing. |

The codemod is conservative: it never deletes content, only rewrites surface syntax. If a custom skill or module can't be auto-migrated, it's left in place and flagged for manual review.

---

## How to request help

If you encounter a migration problem the docs don't cover, file an issue at https://github.com/razalrahmanp/imatter/issues with:

1. The migration command you ran (e.g. `sdlc-migrate --apply --to=1.4.0`).
2. The output, both stdout and stderr.
3. Your starting version and target version.
4. Whether you have custom skills or compliance modules.
5. Whether you can share `SDLC_VALIDATION.md` (sanitised if it has PII).

We treat broken upgrades as P0 issues — they erode the trust the framework depends on.
