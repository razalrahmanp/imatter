# Migration Chain Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an end-to-end test suite for `runMigrations` covering the 1.0.0→1.1.0 upgrade path: version marker insertion, backup creation, disk-write verification, dry-run safety, idempotency, and the full migrate→tag pipeline.

**Architecture:** Node.js built-in `node:test` runner (zero new dependencies). Tests import TypeScript source directly via `node --import tsx/esm --test`. Each test writes to an OS temp dir and cleans up with `finally`. The test file is a single focused module — no test framework config, no jest setup.

**Tech Stack:** Node.js 22.14 (`node:test`, `node:assert/strict`, `node:fs`, `node:os`), tsx 4.7 (already in devDependencies)

---

## File Map

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `sdlc-mcp-server/package.json` | Add `test` script |
| Create | `sdlc-mcp-server/src/test/fixtures/minimal-v1.0.0.md` | v1.0.0 SDLC fixture (no version marker, no region markers) |
| Create | `sdlc-mcp-server/src/test/migration-chain.test.ts` | All migration chain tests |

---

### Task 1: Test infrastructure

**Files:**
- Modify: `sdlc-mcp-server/package.json`
- Create: `sdlc-mcp-server/src/test/fixtures/minimal-v1.0.0.md`
- Create: `sdlc-mcp-server/src/test/migration-chain.test.ts` (smoke test only)

- [ ] **Step 1: Add test script to package.json**

In `sdlc-mcp-server/package.json`, add `"test"` to `"scripts"`:

```json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "start:http": "cross-env MCP_TRANSPORT=http node dist/index.js",
  "dev": "tsx src/index.ts",
  "dev:http": "cross-env MCP_TRANSPORT=http tsx src/index.ts",
  "generate-template": "tsx src/generate-template.ts",
  "test": "node --import tsx/esm --test src/test/migration-chain.test.ts"
}
```

- [ ] **Step 2: Create the v1.0.0 fixture file**

Create `sdlc-mcp-server/src/test/fixtures/minimal-v1.0.0.md` with this exact content (no `<!-- SDLC:version -->` marker, no region markers — this is what a v1.0.0 document looks like before migration):

```markdown
# Test Project SDLC Validation

This document tracks SDLC gate compliance for a test project.

## 0. Protocol Rules — Claude must read this first

Before working on any stage, read the gate criteria for that stage. Do not mark a gate PASSED without file:line citations.

---

## 1. Project Identity

- **Project:** test-project
- **Owner:** test
- **Stack:** TypeScript

---

## Quick Reference — Gate Status Summary

| Stage | Name | Status | Last Updated |
| --- | --- | --- | --- |
| 1 | Inception & Requirements | NOT STARTED | — |
```

- [ ] **Step 3: Create the test file with a smoke test**

Create `sdlc-mcp-server/src/test/migration-chain.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runMigrations } from "../migration.js";
import { migration } from "../migrations/1.0.0-to-1.1.0.js";
import { parseRegions } from "../regions.js";
import { generateTaggedTemplate } from "../template-generator.js";

// Normalize CRLF so fixture content matches what readSdlcContent returns
const FIXTURE = readFileSync(
  new URL("./fixtures/minimal-v1.0.0.md", import.meta.url),
  "utf-8",
).replace(/\r\n/g, "\n");

function makeTempDir(): string {
  const dir = join(
    tmpdir(),
    `sdlc-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// ── Smoke ─────────────────────────────────────────────────────────────────────

test("smoke: migration script metadata is correct", () => {
  assert.equal(migration.from, "1.0.0");
  assert.equal(migration.to, "1.1.0");
  assert.ok(migration.description.length > 0);
});
```

- [ ] **Step 4: Run the smoke test to verify the runner works**

From `sdlc-mcp-server/`:
```
npm test
```

Expected output (key lines):
```
▶ smoke: migration script metadata is correct
  ✓ smoke: migration script metadata is correct (Xms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

If you see `Error: Cannot find module '../migration.js'` the test file path is wrong — verify you created it at `src/test/migration-chain.test.ts`, not `src/migration-chain.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add sdlc-mcp-server/package.json sdlc-mcp-server/src/test/fixtures/minimal-v1.0.0.md sdlc-mcp-server/src/test/migration-chain.test.ts
git commit -m "test: add migration chain test scaffold with smoke test

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Core migration tests (1.0.0 → 1.1.0)

**Files:**
- Modify: `sdlc-mcp-server/src/test/migration-chain.test.ts`

- [ ] **Step 1: Append the core migration tests**

Add the following after the smoke test in `migration-chain.test.ts`:

```typescript
// ── Core migration: version marker insertion ───────────────────────────────────

test("runMigrations 1.0.0→1.1.0: inserts version marker and reports step", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    const result = await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    assert.equal(result.finalVersion, "1.1.0");
    assert.ok(
      result.finalContent.includes('<!-- SDLC:version "1.1.0" -->'),
      "finalContent must contain the version marker",
    );
    assert.equal(result.steps.length, 1);
    assert.equal(result.steps[0].from, "1.0.0");
    assert.equal(result.steps[0].to, "1.1.0");
    assert.ok(result.allChanges.length > 0, "must report at least one change");
  } finally {
    cleanup(dir);
  }
});

test("runMigrations 1.0.0→1.1.0: parseRegions sees frameworkVersion 1.1.0", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    const result = await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    const parsed = parseRegions(result.finalContent);
    assert.equal(
      parsed.frameworkVersion,
      "1.1.0",
      "parseRegions must extract frameworkVersion from the version marker",
    );
  } finally {
    cleanup(dir);
  }
});

test("runMigrations 1.0.0→1.1.0: version marker is placed immediately after H1", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    const result = await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    const lines = result.finalContent.split("\n");
    const h1Index = lines.findIndex((l) => l.trim().startsWith("# "));
    assert.ok(h1Index >= 0, "H1 must be present");
    assert.equal(
      lines[h1Index + 1],
      '<!-- SDLC:version "1.1.0" -->',
      "version marker must be the line immediately after the H1",
    );
  } finally {
    cleanup(dir);
  }
});
```

- [ ] **Step 2: Run tests**

```
npm test
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add sdlc-mcp-server/src/test/migration-chain.test.ts
git commit -m "test: add core 1.0.0→1.1.0 version marker insertion tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Backup and disk-write tests

**Files:**
- Modify: `sdlc-mcp-server/src/test/migration-chain.test.ts`

- [ ] **Step 1: Append backup and disk-write tests**

Add the following to `migration-chain.test.ts`:

```typescript
// ── Backup and disk-write ─────────────────────────────────────────────────────

test("runMigrations: creates backup before mutating the file", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    const result = await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    assert.ok(result.backupPath !== null, "backupPath must be non-null");
    const backupFile = join(result.backupPath!, "SDLC_VALIDATION.md");
    assert.ok(existsSync(backupFile), `backup file must exist at ${backupFile}`);

    const backupContent = readFileSync(backupFile, "utf-8");
    assert.ok(
      !backupContent.includes('<!-- SDLC:version "1.1.0" -->'),
      "backup must contain original v1.0.0 content without the version marker",
    );
  } finally {
    cleanup(dir);
  }
});

test("runMigrations: writes migrated content to disk", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    const onDisk = readFileSync(sdlcPath, "utf-8");
    assert.ok(
      onDisk.includes('<!-- SDLC:version "1.1.0" -->'),
      "version marker must be present in the on-disk file after migration",
    );
  } finally {
    cleanup(dir);
  }
});
```

- [ ] **Step 2: Run tests**

```
npm test
```

Expected: 6 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add sdlc-mcp-server/src/test/migration-chain.test.ts
git commit -m "test: add backup creation and disk-write verification tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Dry-run and idempotency tests

**Files:**
- Modify: `sdlc-mcp-server/src/test/migration-chain.test.ts`

- [ ] **Step 1: Append dry-run and idempotency tests**

Add the following to `migration-chain.test.ts`:

```typescript
// ── Dry-run ───────────────────────────────────────────────────────────────────

test("runMigrations dry-run: does not write to disk, backupPath is null", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    const result = await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: true,
    });

    assert.equal(result.backupPath, null, "dry-run must not create a backup");

    const onDisk = readFileSync(sdlcPath, "utf-8");
    assert.ok(
      !onDisk.includes('<!-- SDLC:version "1.1.0" -->'),
      "dry-run must not write to the file on disk",
    );

    assert.ok(
      result.finalContent.includes('<!-- SDLC:version "1.1.0" -->'),
      "dry-run must still return migrated content in-memory via finalContent",
    );
  } finally {
    cleanup(dir);
  }
});

// ── Idempotency ───────────────────────────────────────────────────────────────

test("runMigrations: idempotent — second run does not duplicate the version marker", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    const opts = {
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    };

    await runMigrations(opts);       // first run — mutates SDLC_VALIDATION.md on disk
    const result2 = await runMigrations(opts); // second run — re-reads from disk

    const markerCount = (
      result2.finalContent.match(/<!-- SDLC:version "1\.1\.0" -->/g) ?? []
    ).length;
    assert.equal(markerCount, 1, "version marker must appear exactly once after two runs");

    assert.ok(
      result2.allWarnings.some((w) => w.includes("already present")),
      "second run must warn that the marker is already present",
    );
  } finally {
    cleanup(dir);
  }
});

test("runMigrations: no-op when fromVersion already equals toVersion", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    const result = await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.1.0",   // already at target — no applicable scripts
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    assert.equal(result.steps.length, 0, "no steps should run when already at target version");
    assert.equal(result.backupPath, null, "no backup when no migration runs");
    assert.equal(result.allChanges.length, 0);
  } finally {
    cleanup(dir);
  }
});
```

- [ ] **Step 2: Run tests**

```
npm test
```

Expected: 9 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add sdlc-mcp-server/src/test/migration-chain.test.ts
git commit -m "test: add dry-run and idempotency tests for migration chain

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Post-migration tagging pipeline test

**Files:**
- Modify: `sdlc-mcp-server/src/test/migration-chain.test.ts`

This task tests the full upgrade sequence: `runMigrations` (inserts version marker) → `generateTaggedTemplate` (wraps sections in region markers) → `parseRegions` (verifies the output is structurally valid). This is the critical integration test that proves the two halves of the upgrade system compose correctly.

- [ ] **Step 1: Append the pipeline integration test**

Add the following to `migration-chain.test.ts`:

```typescript
// ── Pipeline: migrate → tag ───────────────────────────────────────────────────

test("pipeline: migrate then generateTaggedTemplate produces zero parse errors", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    // Step 1: migrate 1.0.0 → 1.1.0 (inserts version marker)
    const migrated = await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    assert.ok(
      migrated.finalContent.includes('<!-- SDLC:version "1.1.0" -->'),
      "precondition: migrated content must have version marker",
    );

    // Step 2: apply region markers (the sdlc-tag --force step)
    const generated = generateTaggedTemplate(migrated.finalContent, "1.1.0");
    assert.ok(generated.tagged.length > 0, "tagged output must be non-empty");

    // Step 3: parse the tagged output
    const parsed = parseRegions(generated.tagged);

    assert.equal(
      parsed.errors.length,
      0,
      `parseRegions must find 0 errors after full pipeline; got:\n  ${
        parsed.errors.map((e) => e.message).join("\n  ")
      }`,
    );

    assert.ok(parsed.regions.length > 0, "must have at least one region after tagging");

    // frameworkVersion must survive the full migrate→tag→parse round-trip
    assert.equal(
      parsed.frameworkVersion,
      "1.1.0",
      "frameworkVersion must be 1.1.0 after full pipeline",
    );
  } finally {
    cleanup(dir);
  }
});

test("pipeline: tagged output registry contains known SECTION_MAP regions", async () => {
  const dir = makeTempDir();
  try {
    const sdlcPath = join(dir, "SDLC_VALIDATION.md");
    writeFileSync(sdlcPath, FIXTURE, "utf-8");

    const migrated = await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    const generated = generateTaggedTemplate(migrated.finalContent, "1.1.0");

    // The fixture contains "0. Protocol Rules..." and "1. Project Identity"
    // and "Quick Reference — Gate Status Summary"
    assert.ok(
      generated.registry.has("protocol-rules"),
      "registry must contain protocol-rules region",
    );
    assert.ok(
      generated.registry.has("project-identity"),
      "registry must contain project-identity region",
    );
    assert.ok(
      generated.registry.has("quick-reference"),
      "registry must contain quick-reference region",
    );

    // No unknown sections — the fixture only uses known headings
    assert.equal(
      generated.unknownSections.length,
      0,
      `fixture must not introduce unknown sections; got: ${generated.unknownSections.join(", ")}`,
    );
  } finally {
    cleanup(dir);
  }
});
```

- [ ] **Step 2: Run tests**

```
npm test
```

Expected: 11 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```bash
git add sdlc-mcp-server/src/test/migration-chain.test.ts
git commit -m "test: add migrate→tag→parse pipeline integration tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

Checking coverage against the session spec:

| Requirement | Task | Status |
| --- | --- | --- |
| Version marker inserted | Task 2 | ✅ |
| `frameworkVersion === "1.1.0"` via `parseRegions` | Task 2 | ✅ |
| Marker placed immediately after H1 | Task 2 | ✅ |
| Backup created before mutation | Task 3 | ✅ |
| Backup contains original content (no marker) | Task 3 | ✅ |
| Disk file updated after migration | Task 3 | ✅ |
| Dry-run: no disk write, `backupPath === null` | Task 4 | ✅ |
| Dry-run: `finalContent` still has marker (in-memory) | Task 4 | ✅ |
| Idempotency: second run doesn't duplicate marker | Task 4 | ✅ |
| No-op when already at target version | Task 4 | ✅ |
| `generateTaggedTemplate` produces 0 parse errors | Task 5 | ✅ |
| `frameworkVersion` survives full pipeline | Task 5 | ✅ |
| Registry contains known SECTION_MAP regions | Task 5 | ✅ |

No placeholders. All test functions have complete code. Import paths match actual source file structure (`../migration.js`, `../migrations/1.0.0-to-1.1.0.js`, `../regions.js`, `../template-generator.js`). Types match the interfaces defined in `migration.ts` (`RunOptions`, `RunResult`). `GenerateResult.tagged`, `GenerateResult.registry`, `GenerateResult.unknownSections` match `template-generator.ts:226`.
