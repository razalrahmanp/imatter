# `sdlc_verify_history` + `sdlc_trace_requirements` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two MCP audit tools: `sdlc_verify_history` (HMAC integrity check on gate history) and `sdlc_trace_requirements` (trace a requirement ID through SDLC sections and gate statuses).

**Architecture:** Extract business logic into a new `src/audit.ts` module (testable in isolation). Register both tools in the existing `src/server.ts`. Tests use the same `node --import tsx/esm --test` runner already wired up.

**Tech Stack:** TypeScript ESM, `node:crypto` (via `integrity.ts`), `node:fs`, `zod` (already in deps), MCP SDK (already wired)

---

## File Map

| Action | Path | Responsibility |
| --- | --- | --- |
| Create | `sdlc-mcp-server/src/audit.ts` | `buildHistoryVerifyReport()` + `traceRequirementsInDoc()` |
| Create | `sdlc-mcp-server/src/test/audit.test.ts` | Tests for both helpers |
| Modify | `sdlc-mcp-server/package.json` | Extend `test` script to cover `audit.test.ts` |
| Modify | `sdlc-mcp-server/src/server.ts` | Register `sdlc_verify_history` + `sdlc_trace_requirements` tools |

---

### Task 1: `audit.ts` — helpers + tests (TDD)

**Files:**
- Create: `sdlc-mcp-server/src/audit.ts`
- Create: `sdlc-mcp-server/src/test/audit.test.ts`
- Modify: `sdlc-mcp-server/package.json`

- [ ] **Step 1: Update the `test` script in `package.json`**

Replace the current `"test"` script value with one that runs all test files:

```json
"test": "node --import tsx/esm --test src/test/migration-chain.test.ts src/test/audit.test.ts"
```

- [ ] **Step 2: Write the failing tests first**

Create `sdlc-mcp-server/src/test/audit.test.ts`:

```typescript
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildHistoryVerifyReport } from "../audit.js";
import { traceRequirementsInDoc } from "../audit.js";
import type { GateStatus } from "../sdlc.js";

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
      /No .sdlc-state.json/,
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
```

- [ ] **Step 3: Run tests to confirm they fail (module does not exist yet)**

```
npm test
```

Expected: errors like `Cannot find module '../audit.js'`.

- [ ] **Step 4: Create `sdlc-mcp-server/src/audit.ts`**

```typescript
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadKey,
  computeEntryHmac,
  computeCursorHmac,
  computeTopLevelHmac,
  fileHash,
  type EntryFields,
  type CursorFields,
} from "./integrity.js";
import type { GateStatus } from "./sdlc.js";

// ── verify_history ────────────────────────────────────────────────────────────

export interface EntryVerifyResult {
  stage: number;
  name: string;
  gate: string;
  cleared_at: string;
  score: number;
  hmac: "valid" | "invalid" | "unsigned";
  docHash: "valid" | "invalid" | "not_on_disk" | "not_recorded";
}

export interface HistoryVerifyReport {
  ok: boolean;
  keyPresent: boolean;
  topLevel: "valid" | "invalid" | "unsigned";
  cursor: "valid" | "invalid" | "unsigned";
  entries: EntryVerifyResult[];
  errors: string[];
  warnings: string[];
}

export function buildHistoryVerifyReport(projectRoot: string): HistoryVerifyReport {
  const statePath = join(projectRoot, ".sdlc-state.json");
  if (!existsSync(statePath)) {
    throw new Error(`No .sdlc-state.json found at ${statePath}`);
  }

  const raw = JSON.parse(readFileSync(statePath, "utf-8")) as Record<string, unknown>;
  const key = loadKey(projectRoot);
  const keyPresent = key !== null;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Top-level signature
  let topLevel: "valid" | "invalid" | "unsigned" = "unsigned";
  if (key) {
    const sig = (raw._signature as { value?: string } | undefined)?.value;
    if (sig) {
      topLevel = computeTopLevelHmac(raw, key) === sig ? "valid" : "invalid";
      if (topLevel === "invalid") errors.push("Top-level HMAC mismatch — state file may have been edited outside the tool.");
    } else {
      warnings.push("No top-level signature — state pre-dates integrity protection.");
    }
  }

  // Cursor HMAC
  let cursor: "valid" | "invalid" | "unsigned" = "unsigned";
  if (key) {
    const c = raw.cursor as (CursorFields & { hmac?: string }) | undefined;
    if (c?.hmac) {
      cursor = computeCursorHmac(c, key) === c.hmac ? "valid" : "invalid";
      if (cursor === "invalid") errors.push("Cursor HMAC mismatch — cursor may have been edited.");
    }
  }

  // Per-entry
  type RawEntry = EntryFields & { hmac?: string; doc?: string; doc_sha256?: string | null };
  const history = (raw.history as RawEntry[]) ?? [];

  const entries: EntryVerifyResult[] = history.map((entry) => {
    let hmacStatus: EntryVerifyResult["hmac"] = "unsigned";
    if (key && entry.hmac) {
      const expected = computeEntryHmac(entry, key);
      hmacStatus = expected === entry.hmac ? "valid" : "invalid";
      if (hmacStatus === "invalid") {
        errors.push(`Stage ${entry.stage} (${entry.name}) history entry HMAC mismatch.`);
      }
    } else if (key && !entry.hmac) {
      warnings.push(`Stage ${entry.stage} (${entry.name}) entry is unsigned (pre-integrity).`);
    }

    let docHash: EntryVerifyResult["docHash"] = "not_recorded";
    if (entry.doc_sha256 && entry.doc) {
      const docAbsPath = entry.doc.startsWith("/") || /^[A-Za-z]:\\/.test(entry.doc)
        ? entry.doc
        : join(projectRoot, entry.doc);
      if (existsSync(docAbsPath)) {
        const onDisk = fileHash(docAbsPath);
        docHash = onDisk === entry.doc_sha256 ? "valid" : "invalid";
        if (docHash === "invalid") {
          errors.push(`Stage ${entry.stage} findings doc hash mismatch — doc may have been edited: ${entry.doc}`);
        }
      } else {
        docHash = "not_on_disk";
        warnings.push(`Stage ${entry.stage} findings doc not found on disk: ${entry.doc}`);
      }
    }

    return {
      stage: entry.stage,
      name: entry.name,
      gate: entry.gate,
      cleared_at: entry.cleared_at,
      score: entry.score ?? 0,
      hmac: hmacStatus,
      docHash,
    };
  });

  return {
    ok: errors.length === 0,
    keyPresent,
    topLevel,
    cursor,
    entries,
    errors,
    warnings,
  };
}

// ── trace_requirements ────────────────────────────────────────────────────────

export interface RequirementHit {
  line: number;
  text: string;
}

export interface RequirementMatch {
  sectionHeading: string;
  stageNumber: number | null;
  gateStatus: string | null;
  hits: RequirementHit[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractStageNumber(heading: string): number | null {
  const m = heading.match(/Stage\s+(\d+)/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function traceRequirementsInDoc(
  content: string,
  reqId: string,
  caseSensitive: boolean,
  gateStatuses: GateStatus[],
): RequirementMatch[] {
  const lines = content.split("\n");
  const flags = caseSensitive ? "g" : "gi";
  const pattern = new RegExp(escapeRegex(reqId), flags);

  // Split content into ## sections
  const sections: { heading: string; startLine: number; lines: string[] }[] = [];
  let current: { heading: string; startLine: number; lines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      if (current) sections.push(current);
      current = { heading: lines[i].slice(3).trim(), startLine: i, lines: [] };
    } else if (current) {
      current.lines.push(lines[i]);
    }
  }
  if (current) sections.push(current);

  const result: RequirementMatch[] = [];

  for (const section of sections) {
    const hits: RequirementHit[] = [];
    for (let j = 0; j < section.lines.length; j++) {
      pattern.lastIndex = 0;
      if (pattern.test(section.lines[j])) {
        hits.push({
          line: section.startLine + j + 2, // 1-indexed, +1 for heading line, +1 for 0→1
          text: section.lines[j].trim(),
        });
      }
    }
    if (hits.length === 0) continue;

    const stageNumber = extractStageNumber(section.heading);
    const gateStatus = stageNumber !== null
      ? (gateStatuses.find((g) => g.stage === stageNumber)?.status ?? null)
      : null;

    result.push({ sectionHeading: section.heading, stageNumber, gateStatus, hits });
  }

  return result;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```
npm test
```

Expected: 11 (migration) + 11 (audit) = 22 tests pass, 0 fail.

If you see `TS2305: Module '"./integrity.js"' has no exported member 'CursorFields'`, verify `integrity.ts` exports `CursorFields` (it does, at line 76). If `computeTopLevelHmac` is missing, check `integrity.ts` line 99.

- [ ] **Step 6: Commit**

```bash
git add sdlc-mcp-server/package.json sdlc-mcp-server/src/audit.ts sdlc-mcp-server/src/test/audit.test.ts
git commit -m "feat: add audit.ts with buildHistoryVerifyReport and traceRequirementsInDoc helpers

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Register both MCP tools in `server.ts`

**Files:**
- Modify: `sdlc-mcp-server/src/server.ts`

- [ ] **Step 1: Add import for audit helpers**

Near the top of `server.ts`, after the existing imports, add:

```typescript
import { buildHistoryVerifyReport, traceRequirementsInDoc } from "./audit.js";
```

- [ ] **Step 2: Register `sdlc_verify_history`**

Add after the last existing `server.tool(...)` call (before the `return server;` line):

```typescript
  server.tool(
    "sdlc_verify_history",
    "Verify the cryptographic integrity of SDLC gate history. Checks HMAC signatures on every " +
      "history entry, the cursor, and the top-level state file. Call when you suspect the state " +
      "file may have been edited outside the tool or to audit gate records before a compliance review.",
    { project_root: z.string().optional() },
    async ({ project_root }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const report = buildHistoryVerifyReport(root);

        const statusLine = report.ok
          ? "✅ VERIFIED — no tampering detected"
          : "❌ INTEGRITY VIOLATION — do not proceed until state is restored from git";

        const keyLine = report.keyPresent
          ? "Key: present"
          : "Key: MISSING — state is unprotected (run sdlc_state_create to generate a key)";

        const sigLine = `Top-level signature: ${report.topLevel}`;
        const cursorLine = `Cursor HMAC: ${report.cursor}`;

        const entryLines =
          report.entries.length === 0
            ? "  (no history entries)"
            : report.entries
                .map(
                  (e) =>
                    `  Stage ${e.stage} (${e.name}): gate=${e.gate} score=${e.score} ` +
                    `hmac=${e.hmac} doc=${e.docHash} cleared=${e.cleared_at}`,
                )
                .join("\n");

        const errorBlock =
          report.errors.length > 0
            ? `\n\nERRORS:\n${report.errors.map((e) => `  ⛔ ${e}`).join("\n")}`
            : "";

        const warnBlock =
          report.warnings.length > 0
            ? `\n\nWARNINGS:\n${report.warnings.map((w) => `  ⚠ ${w}`).join("\n")}`
            : "";

        const text =
          `${statusLine}\n${keyLine} | ${sigLine} | ${cursorLine}\n\n` +
          `History (${report.entries.length} entr${report.entries.length === 1 ? "y" : "ies"}):\n` +
          entryLines + errorBlock + warnBlock;

        return { content: [{ type: "text", text }], isError: !report.ok };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    },
  );

  server.tool(
    "sdlc_trace_requirements",
    "Trace a requirement identifier through SDLC_VALIDATION.md and gate history. Shows every " +
      "section that mentions the requirement and the gate status of each matched stage. " +
      "Use to answer 'Has FR-1.2 been addressed in every relevant gate?'",
    {
      requirement_id: z
        .string()
        .describe("Requirement identifier to search for (e.g. 'FR-1.2', 'NFR-P-1', or any keyword)"),
      project_root: z.string().optional(),
      case_sensitive: z
        .boolean()
        .optional()
        .describe("Case-sensitive search. Default false."),
    },
    async ({ requirement_id, project_root, case_sensitive = false }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const sdlcPath = findSdlcFile(root);
        const content = readSdlcContent(sdlcPath);
        const gateStatuses = getGateStatuses(content);

        const matches = traceRequirementsInDoc(content, requirement_id, case_sensitive, gateStatuses);

        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `"${requirement_id}" not found in any section of ${sdlcPath}.`,
              },
            ],
          };
        }

        const lines: string[] = [
          `Requirement trace: "${requirement_id}" — ${matches.length} section(s) with matches`,
          `Source: ${sdlcPath}`,
          "",
        ];

        for (const m of matches) {
          const stageTag = m.stageNumber !== null ? ` [Stage ${m.stageNumber}]` : "";
          const gateTag = m.gateStatus ? ` — gate: ${m.gateStatus}` : "";
          lines.push(`### ${m.sectionHeading}${stageTag}${gateTag}`);
          for (const h of m.hits) {
            lines.push(`  L${h.line}: ${h.text}`);
          }
          lines.push("");
        }

        const stageMatches = matches.filter((m) => m.stageNumber !== null);
        if (stageMatches.length > 0) {
          const passed = stageMatches.filter(
            (m) => m.gateStatus === "PASSED" || m.gateStatus === "ONGOING",
          );
          const unpassed = stageMatches.filter(
            (m) => m.gateStatus !== "PASSED" && m.gateStatus !== "ONGOING",
          );
          lines.push(
            `Coverage: ${stageMatches.length} stage(s) mention this requirement — ` +
              `${passed.length} PASSED/ONGOING, ${unpassed.length} not yet passed`,
          );
          if (unpassed.length > 0) {
            lines.push(
              `Not yet passed: ${unpassed.map((m) => `Stage ${m.stageNumber}`).join(", ")}`,
            );
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    },
  );
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```
npm test
```

Expected: 22 tests pass, 0 fail. (The new tools have no unit tests of their own since the logic is in `audit.ts` which is already tested.)

- [ ] **Step 4: Build to catch TypeScript errors**

```
npm run build
```

Expected: 0 errors. If you see `TS2305` (missing export), verify the import path is `"./audit.js"` (not `.ts`). If you see type errors on the `case_sensitive = false` default, change to `case_sensitive ?? false` inside the handler.

- [ ] **Step 5: Commit**

```bash
git add sdlc-mcp-server/src/server.ts
git commit -m "feat: register sdlc_verify_history and sdlc_trace_requirements MCP tools

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Integration smoke tests + update `plugin/dist`

**Files:**
- Modify: `sdlc-mcp-server/src/test/audit.test.ts` (add two smoke tests against real project state)
- Modify: `sdlc-mcp-server/package.json` (add `build:plugin` script if missing — check first)

- [ ] **Step 1: Add integration smoke tests against the real project state**

Append to `sdlc-mcp-server/src/test/audit.test.ts`:

```typescript
// ── Integration: real project state ──────────────────────────────────────────
// These tests run against the actual .sdlc-state.json in the project root.
// They are smoke tests — they verify the tool doesn't crash and returns
// a structurally valid report. They do NOT assert specific gate verdicts
// because those change as the project progresses.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(fileURLToPath(import.meta.url), "../../../../..");

test("integration: buildHistoryVerifyReport does not throw on real project state", () => {
  const report = buildHistoryVerifyReport(PROJECT_ROOT);
  assert.ok(typeof report.ok === "boolean");
  assert.ok(Array.isArray(report.entries));
  assert.ok(Array.isArray(report.errors));
  assert.ok(Array.isArray(report.warnings));
});

test("integration: traceRequirementsInDoc works on real SDLC_VALIDATION.md", () => {
  const { readFileSync } = await import("node:fs");
  const { getGateStatuses } = await import("../sdlc.js");
  const sdlcPath = resolve(PROJECT_ROOT, "SDLC_VALIDATION.md");
  const content = readFileSync(sdlcPath, "utf-8");
  const gates = getGateStatuses(content);
  // Search for something that definitely exists in the doc
  const matches = traceRequirementsInDoc(content, "Stage", false, gates);
  assert.ok(matches.length > 0, "any SDLC doc should have multiple sections mentioning 'Stage'");
});
```

- [ ] **Step 2: Run all tests**

```
npm test
```

Expected: 24 tests pass (22 + 2 integration), 0 fail.

- [ ] **Step 3: Build and copy dist to `plugin/dist`**

The tsconfig `outDir` is `../plugin/dist`, so the build step already writes to the correct location:

```
npm run build
```

Expected: exits 0. Verify `plugin/dist/audit.js` and `plugin/dist/audit.d.ts` exist.

Check: `ls g:\PROJECT\Learning Projects\plugin\dist\audit.js` (Windows PowerShell).

- [ ] **Step 4: Commit**

```bash
git add sdlc-mcp-server/src/test/audit.test.ts plugin/dist/audit.js plugin/dist/audit.js.map plugin/dist/audit.d.ts plugin/dist/server.js plugin/dist/server.js.map plugin/dist/server.d.ts
git commit -m "feat: add integration smoke tests and rebuild plugin/dist with audit tools

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Self-Review

Checking coverage against the session spec ("build `sdlc_verify_history` + `sdlc_trace_requirements`"):

| Requirement | Task | Status |
| --- | --- | --- |
| `sdlc_verify_history` tool registered in MCP server | Task 2 | ✅ |
| Checks top-level HMAC | Task 1 (`buildHistoryVerifyReport`) | ✅ |
| Checks cursor HMAC | Task 1 | ✅ |
| Checks per-entry HMACs | Task 1 | ✅ |
| Checks findings doc hashes | Task 1 | ✅ |
| Returns `isError: true` when tampering detected | Task 2 (tool handler) | ✅ |
| `sdlc_trace_requirements` tool registered | Task 2 | ✅ |
| Searches SDLC sections for requirement ID | Task 1 (`traceRequirementsInDoc`) | ✅ |
| Reports gate status per matched stage | Task 1 | ✅ |
| Case-insensitive by default | Task 1 | ✅ |
| Coverage summary (passed vs unpassed stages) | Task 2 (tool output) | ✅ |
| Unit tests for both helpers | Task 1 | ✅ |
| Integration smoke tests | Task 3 | ✅ |
| `plugin/dist` rebuilt | Task 3 | ✅ |

No placeholders. All code blocks are complete.
