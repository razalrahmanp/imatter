import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migration } from "../migrations/1.0.0-to-1.1.0.js";
import { runMigrations } from "../migration.js";
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

// Shared helper: write FIXTURE to disk in dir, run the 1.0.0→1.1.0 migration, return result
async function migrateFixture(dir: string, dryRun = false) {
  const sdlcPath = join(dir, "SDLC_VALIDATION.md");
  writeFileSync(sdlcPath, FIXTURE, "utf-8");
  return runMigrations({
    projectRoot: dir,
    sdlcPath,
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    scripts: [migration],
    registryPath: join(dir, "nonexistent-registry.json"),
    dryRun,
  });
}

// ── Smoke ─────────────────────────────────────────────────────────────────────

test("smoke: migration script metadata is correct", () => {
  assert.equal(migration.from, "1.0.0");
  assert.equal(migration.to, "1.1.0");
  assert.ok(migration.description.length > 0);
});

// ── Core migration: version marker insertion ───────────────────────────────────

test("runMigrations 1.0.0→1.1.0: inserts version marker and reports step", async () => {
  const dir = makeTempDir();
  try {
    const result = await migrateFixture(dir);

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
    const result = await migrateFixture(dir);

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
    const result = await migrateFixture(dir);

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

// ── Backup and disk-write ─────────────────────────────────────────────────────

test("runMigrations: creates backup before mutating the file", async () => {
  const dir = makeTempDir();
  try {
    const result = await migrateFixture(dir);

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
    await migrateFixture(dir);
    const onDisk = readFileSync(join(dir, "SDLC_VALIDATION.md"), "utf-8");
    assert.ok(
      onDisk.includes('<!-- SDLC:version "1.1.0" -->'),
      "version marker must be present in the on-disk file after migration",
    );
  } finally {
    cleanup(dir);
  }
});

// ── Dry-run ───────────────────────────────────────────────────────────────────

test("runMigrations dry-run: does not write to disk, backupPath is null", async () => {
  const dir = makeTempDir();
  try {
    const result = await migrateFixture(dir, true);

    assert.equal(result.backupPath, null, "dry-run must not create a backup");

    const onDisk = readFileSync(join(dir, "SDLC_VALIDATION.md"), "utf-8");
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

    // First run — mutates SDLC_VALIDATION.md on disk
    await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.0.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    // Second run: caller correctly bumps fromVersion to 1.1.0
    // The runner's filter skips the script entirely (1.1.0 > 1.1.0 = false)
    const result2 = await runMigrations({
      projectRoot: dir,
      sdlcPath,
      fromVersion: "1.1.0",
      toVersion: "1.1.0",
      scripts: [migration],
      registryPath: join(dir, "nonexistent-registry.json"),
      dryRun: false,
    });

    assert.equal(result2.steps.length, 0, "runner must skip all scripts when already at target version");
    assert.equal(result2.backupPath, null, "no backup when no migration runs");
    assert.equal(result2.allChanges.length, 0, "no changes when no migration runs");

    // The on-disk file must still have exactly one marker from the first run
    const onDisk = readFileSync(sdlcPath, "utf-8");
    const markerCount = (onDisk.match(/<!-- SDLC:version "1\.1\.0" -->/g) ?? []).length;
    assert.equal(markerCount, 1, "version marker must appear exactly once on disk after two runs");
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
    assert.equal(result.finalVersion, "1.1.0", "finalVersion must equal fromVersion on no-op path");
  } finally {
    cleanup(dir);
  }
});

// ── Pipeline: migrate → tag ───────────────────────────────────────────────────

test("pipeline: migrate then generateTaggedTemplate produces zero parse errors", async () => {
  const dir = makeTempDir();
  try {
    // Step 1: migrate 1.0.0 → 1.1.0 (inserts version marker)
    const migrated = await migrateFixture(dir);

    assert.ok(
      migrated.finalContent.includes('<!-- SDLC:version "1.1.0" -->'),
      "precondition: migrated content must have version marker before tagging",
    );

    // Step 2: apply region markers (the sdlc-tag --force step)
    const generated = generateTaggedTemplate(migrated.finalContent, "1.1.0");
    assert.ok(generated.tagged.length > 0, "tagged output must be non-empty");

    // Must contain exactly one version marker — not two (bug guard for migrate→tag handoff)
    assert.equal(
      (generated.tagged.match(/<!-- SDLC:version/g) ?? []).length,
      1,
      "tagged output must contain exactly one version marker (not duplicated by generateTaggedTemplate)",
    );

    // Step 3: parse the tagged output — must have zero errors
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
    const migrated = await migrateFixture(dir);
    const generated = generateTaggedTemplate(migrated.finalContent, "1.1.0");

    // The fixture contains sections for:
    //   "0. Protocol Rules — Claude must read this first" → id: "protocol-rules"
    //   "1. Project Identity" → id: "project-identity"
    //   "Quick Reference — Gate Status Summary" → id: "quick-reference"
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

    // Fixture only uses known headings — no unknown sections expected
    assert.equal(
      generated.unknownSections.length,
      0,
      `fixture must not introduce unknown sections; got: ${generated.unknownSections.join(", ")}`,
    );
  } finally {
    cleanup(dir);
  }
});
