import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migration } from "../migrations/1.0.0-to-1.1.0.js";

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
