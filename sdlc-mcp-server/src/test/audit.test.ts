import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { buildHistoryVerifyReport } from "../audit.js";
import { traceRequirementsInDoc } from "../audit.js";
import type { GateStatus } from "../sdlc.js";
import { ensureKey, signState } from "../integrity.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `sdlc-audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// ── Minimal state fixtures ────────────────────────────────────────────────────

const MINIMAL_STATE_NO_KEY = {
  schema: "sdlc-state/1.1",
  sdlc_framework_version: "1.1.0",
  project_root: "/tmp/test",
  sdlc_file: "/tmp/test/SDLC_VALIDATION.md",
  cursor: { stage: 1, status: "in_progress", fail_count: 0, started_at: "2026-01-01T00:00:00.000Z" },
  history: [],
  stages: {},
  flagged: [],
  waivers: [],
};

const HISTORY_ENTRY = {
  stage: 1,
  name: "Inception & Requirements",
  gate: "PASSED",
  cleared_at: "2026-01-15T10:00:00.000Z",
  summary: "All criteria met.",
  doc: "",
  doc_sha256: null,
  exports: [],
  score: 90,
  concerns: [],
};

// ── buildHistoryVerifyReport ──────────────────────────────────────────────────

test("buildHistoryVerifyReport: throws if .sdlc-state.json does not exist", () => {
  const dir = makeTempDir();
  try {
    assert.throws(
      () => buildHistoryVerifyReport(dir),
      /No \.sdlc-state\.json/,
    );
  } finally {
    cleanup(dir);
  }
});

test("buildHistoryVerifyReport: reports keyPresent:false when no key file", () => {
  const dir = makeTempDir();
  try {
    writeFileSync(join(dir, ".sdlc-state.json"), JSON.stringify(MINIMAL_STATE_NO_KEY), "utf-8");
    const report = buildHistoryVerifyReport(dir);
    assert.equal(report.keyPresent, false);
    assert.equal(report.ok, true, "no key = unprotected but not tampered");
    assert.equal(report.topLevel, "unsigned");
    assert.equal(report.cursor, "unsigned");
    assert.equal(report.entries.length, 0);
  } finally {
    cleanup(dir);
  }
});

test("buildHistoryVerifyReport: history entry with no hmac reported as unsigned", () => {
  const dir = makeTempDir();
  try {
    const state = { ...MINIMAL_STATE_NO_KEY, history: [HISTORY_ENTRY] };
    writeFileSync(join(dir, ".sdlc-state.json"), JSON.stringify(state), "utf-8");
    const report = buildHistoryVerifyReport(dir);
    assert.equal(report.entries.length, 1);
    assert.equal(report.entries[0].stage, 1);
    assert.equal(report.entries[0].hmac, "unsigned");
    assert.equal(report.entries[0].docHash, "not_recorded");
  } finally {
    cleanup(dir);
  }
});

test("buildHistoryVerifyReport: ok:true with empty history and no key", () => {
  const dir = makeTempDir();
  try {
    writeFileSync(join(dir, ".sdlc-state.json"), JSON.stringify(MINIMAL_STATE_NO_KEY), "utf-8");
    const report = buildHistoryVerifyReport(dir);
    assert.equal(report.ok, true);
    assert.equal(report.errors.length, 0);
  } finally {
    cleanup(dir);
  }
});

test("buildHistoryVerifyReport: keyPresent:true and topLevel:valid when state is properly signed", () => {
  const dir = makeTempDir();
  try {
    // Create the key
    const key = ensureKey(dir);
    assert.ok(key.length > 0, "ensureKey must return a non-empty key");

    // Build and sign a minimal state
    const stateObj = {
      schema: "sdlc-state/1.1",
      sdlc_framework_version: "1.1.0",
      project_root: dir,
      sdlc_file: dir + "/SDLC_VALIDATION.md",
      cursor: { stage: 1, status: "in_progress", fail_count: 0, started_at: "2026-01-01T00:00:00.000Z" },
      history: [],
      stages: {},
      flagged: [],
      waivers: [],
    };

    const signed = signState(stateObj as unknown as Record<string, unknown>, dir);
    writeFileSync(join(dir, ".sdlc-state.json"), JSON.stringify(signed), "utf-8");

    const report = buildHistoryVerifyReport(dir);
    assert.equal(report.keyPresent, true);
    assert.equal(report.topLevel, "valid", "top-level HMAC must verify as valid");
    assert.equal(report.ok, true);
    assert.equal(report.errors.length, 0);
  } finally {
    cleanup(dir);
  }
});

// ── traceRequirementsInDoc ────────────────────────────────────────────────────

const SAMPLE_DOC = `# My Project SDLC

## 2. Stage 1 — Inception & Requirements

The system must implement FR-1.1 user login.
Also see FR-1.2 for password reset.

---

## 3. Stage 2 — Architecture & Design

The login flow (FR-1.1) will use JWT tokens.

---

## Quick Reference — Gate Status Summary

| Stage | Name | Status | Last Updated |
| --- | --- | --- | --- |
| 1 | Inception & Requirements | PASSED | 2026-01-15 |
| 2 | Architecture & Design | IN PROGRESS | — |
`;

const GATE_STATUSES: GateStatus[] = [
  { stage: 1, name: "Inception & Requirements", status: "PASSED", passedDate: "2026-01-15" },
  { stage: 2, name: "Architecture & Design",    status: "IN PROGRESS" },
];

test("traceRequirementsInDoc: finds FR-1.1 in two sections", () => {
  const matches = traceRequirementsInDoc(SAMPLE_DOC, "FR-1.1", false, GATE_STATUSES);
  assert.equal(matches.length, 2, "FR-1.1 should appear in Stage 1 and Stage 2 sections");
});

test("traceRequirementsInDoc: Stage 1 match has gateStatus PASSED", () => {
  const matches = traceRequirementsInDoc(SAMPLE_DOC, "FR-1.1", false, GATE_STATUSES);
  const stage1 = matches.find((m) => m.stageNumber === 1);
  assert.ok(stage1, "should find Stage 1 match");
  assert.equal(stage1!.gateStatus, "PASSED");
  assert.equal(stage1!.hits.length, 1);
});

test("traceRequirementsInDoc: Stage 2 match has gateStatus IN PROGRESS", () => {
  const matches = traceRequirementsInDoc(SAMPLE_DOC, "FR-1.1", false, GATE_STATUSES);
  const stage2 = matches.find((m) => m.stageNumber === 2);
  assert.ok(stage2, "should find Stage 2 match");
  assert.equal(stage2!.gateStatus, "IN PROGRESS");
});

test("traceRequirementsInDoc: returns empty array when requirement not found", () => {
  const matches = traceRequirementsInDoc(SAMPLE_DOC, "FR-9.9", false, GATE_STATUSES);
  assert.equal(matches.length, 0);
});

test("traceRequirementsInDoc: case-insensitive by default", () => {
  const matches = traceRequirementsInDoc(SAMPLE_DOC, "fr-1.1", false, GATE_STATUSES);
  assert.equal(matches.length, 2, "lowercase search must match case-insensitively");
});

test("traceRequirementsInDoc: case-sensitive search misses lowercase variant", () => {
  const matches = traceRequirementsInDoc(SAMPLE_DOC, "fr-1.1", true, GATE_STATUSES);
  assert.equal(matches.length, 0, "case-sensitive search should find nothing for lowercase when doc has uppercase");
});

test("traceRequirementsInDoc: hit line numbers are positive integers", () => {
  const matches = traceRequirementsInDoc(SAMPLE_DOC, "FR-1.2", false, GATE_STATUSES);
  assert.equal(matches.length, 1);
  assert.ok(matches[0].hits[0].line > 0, "line number must be positive");
});

test("traceRequirementsInDoc: hit text is trimmed", () => {
  const matches = traceRequirementsInDoc(SAMPLE_DOC, "FR-1.2", false, GATE_STATUSES);
  const hitText = matches[0].hits[0].text;
  assert.equal(hitText, hitText.trim(), "hit text must be trimmed");
});

// ── Integration: real project state ──────────────────────────────────────────
// Smoke tests against the actual .sdlc-state.json and SDLC_VALIDATION.md.
// Verifies the tools don't crash — does NOT assert specific gate verdicts.

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), "../../../../");

test("integration: buildHistoryVerifyReport does not throw on real project state", () => {
  const report = buildHistoryVerifyReport(PROJECT_ROOT);
  assert.ok(typeof report.ok === "boolean");
  assert.ok(Array.isArray(report.entries));
  assert.ok(Array.isArray(report.errors));
  assert.ok(Array.isArray(report.warnings));
});

test("integration: traceRequirementsInDoc finds matches on real SDLC_VALIDATION.md", async () => {
  const { readFileSync } = await import("node:fs");
  const { getGateStatuses } = await import("../sdlc.js");
  const sdlcPath = resolve(PROJECT_ROOT, "SDLC_VALIDATION.md");
  const content = readFileSync(sdlcPath, "utf-8").replace(/\r\n/g, "\n");
  const gates = getGateStatuses(content);
  const matches = traceRequirementsInDoc(content, "Stage", false, gates);
  assert.ok(matches.length > 0, "real SDLC doc must have sections mentioning 'Stage'");
});
