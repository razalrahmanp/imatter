import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migration } from "../migrations/1.0.0-to-1.1.0.js";
import { runMigrations } from "../migration.js";
import { parseRegions } from "../regions.js";

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
