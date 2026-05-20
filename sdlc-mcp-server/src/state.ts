import { readFileSync, writeFileSync, existsSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { verifyState, signState } from "./integrity.js";

export const FRAMEWORK_VERSION = "1.1.0";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentFinding {
  /** not_applicable: criterion is irrelevant to this project — counts as neutral, not pass or fail */
  status: "pass" | "fail" | "acknowledged" | "not_applicable";
  /** true → gate cannot decide; escalates to human without consuming fail_count */
  requires_human_judgment?: boolean;
  summary: string;
  artifacts: string[];
  flags: string[];
}

export interface SubAgentConfig {
  id: string;
  check: string;
  model: "haiku" | "sonnet" | "opus";
  ns: string;
}

export interface GateCriterion {
  ns: string;
  must: "pass" | "pass_or_acknowledge" | "warn_ok";
  /** "blocking" (default) = criterion failure → FAIL. "concern" = failure → CONCERNS but gate still advances. */
  severity?: "blocking" | "concern";
}

export interface Waiver {
  stage: number;
  criterion_ns: string;
  reason: string;
  approved_by: string;
  waived_at: string;
}

export interface ReviewerConfig {
  /** Roles that satisfy the review requirement (any one suffices unless min_approvals > 1) */
  roles?: string[];
  /** Minimum distinct approvers required. Default 1. */
  min_approvals?: number;
}

export interface StageConfig {
  name: string;
  sdlc_heading: string;
  imports: Array<{ stage: number; key: string }>;
  sub_agents: SubAgentConfig[];
  gate: {
    rule: string;
    criteria: GateCriterion[];
    conflict_threshold: number;
    /** When set, gate cannot advance without explicit sdlc_signoff. */
    reviewer?: ReviewerConfig;
  };
  memory: Record<string, AgentFinding | null>;
}

export interface HistoryEntry {
  stage: number;
  name: string;
  gate: "PASSED" | "PASSED_WITH_CONCERNS" | "FAILED" | "WAIVED";
  cleared_at: string;
  summary: string;
  doc: string;
  doc_sha256?: string | null; // SHA-256 of findings doc at gate time
  exports: string[];
  score: number;       // 0–100 composite quality score
  concerns?: string[]; // non-blocking issues carried into history
  verified_with_framework_version?: string; // framework version that produced this verdict
  hmac?: string;       // HMAC-SHA256 of entry fields — added by signState()
}

export interface PendingSignoff {
  gate_verdict: "PASSED" | "PASSED_WITH_CONCERNS";
  gate_score: number;
  required_roles?: string[];
  requested_at: string;
}

export interface Cursor {
  stage: number;
  status: "in_progress" | "gate_failed" | "awaiting_review" | "pending_signoff";
  fail_count: number;
  started_at: string;
  pending_signoff?: PendingSignoff;
  hmac?: string; // HMAC-SHA256 of cursor fields — added by signState()
}

export interface Signature {
  algorithm: string;
  key_source: string;
  computed_at: string;
  value: string;
}

export interface PendingReview {
  stage: number;
  stage_summary: string;
  doc_path: string;
  doc_sha256: string | null;
  gate_verdict: "PASSED" | "PASSED_WITH_CONCERNS";
  gate_score: number;
  concerns?: string[];
  flags: string[];
  requested_at: string;
}

export interface SdlcState {
  schema: string;
  sdlc_framework_version: string;
  project_root: string;
  sdlc_file: string;
  cursor: Cursor;
  history: HistoryEntry[];
  stages: Record<string, StageConfig>;
  flagged: number[];
  waivers: Waiver[];
  pending_review?: PendingReview; // set when gate passed but reviewer signoff is required
  _signature?: Signature; // top-level HMAC — added by signState(), verified by readState()
}

// ── Task checkpoint types ─────────────────────────────────────────────────────

export interface TaskIteration {
  n: number;
  status: "in_progress" | "blocked" | "complete";
  changes: string;
  next_action: string;
  error?: string;
  error_lines?: string[];
  timestamp: string;
}

export interface TaskCheckpoint {
  task_id: string;
  file: string;
  stage: number;
  plan_ref?: string;
  iterations: TaskIteration[];
  current_iteration: number;
  status: "in_progress" | "blocked" | "complete" | "flagged";
  fail_count: number;
  started_at: string;
  updated_at: string;
}

// ── Structured error types ────────────────────────────────────────────────────

export type ErrorKind =
  | "type_error"
  | "lint_error"
  | "test_fail"
  | "import_error"
  | "syntax_error"
  | "build_error"
  | "unknown";

export interface DiagnosedError {
  kind: ErrorKind;
  severity: "error" | "warning";
  file: string;
  line?: number;
  col?: number;
  message: string;
  raw_excerpt: string;
  fix_hint?: string;
}

// ── State file I/O ────────────────────────────────────────────────────────────

export function statePath(projectRoot: string): string {
  return join(projectRoot, ".sdlc-state.json");
}

export function readState(projectRoot: string): SdlcState {
  const path = statePath(projectRoot);
  if (!existsSync(path)) throw new Error(`No .sdlc-state.json at ${path}. Run sdlc_state_create first.`);
  const raw = JSON.parse(readFileSync(path, "utf-8")) as SdlcState;

  // Integrity check — must run before any field normalisation so the HMAC
  // computed here matches the one written by signState() exactly.
  const verify = verifyState(raw as unknown as Record<string, unknown>, projectRoot);
  if (!verify.ok) {
    throw new Error(
      `SDLC state integrity failure:\n${verify.errors.join("\n")}\n\nRestore state from git before proceeding.`
    );
  }

  // Backward-compat: older state files pre-date waivers field
  if (!raw.waivers) raw.waivers = [];
  // Backward-compat: pre-1.1 state files lack framework version
  if (!raw.sdlc_framework_version) raw.sdlc_framework_version = "1.0.0";
  // Backward-compat: history entries pre-date score field
  for (const h of raw.history) {
    if (h.score === undefined) h.score = 0;
  }
  return raw;
}

/** Atomic write: tmp file → rename. Signs state before serializing. */
export function writeState(projectRoot: string, state: SdlcState): void {
  const path = statePath(projectRoot);
  const tmp = path + ".tmp";
  const signed = signState(state as unknown as Record<string, unknown>, projectRoot);
  writeFileSync(tmp, JSON.stringify(signed, null, 2), "utf-8");
  renameSync(tmp, path);
}

export function ensureSessionDir(projectRoot: string): string {
  const dir = join(projectRoot, ".sdlc-sessions");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

// ── YAML frontmatter parser ───────────────────────────────────────────────────
// Handles the subset used in sNN-findings.md:
//   - scalar values (strings, numbers, booleans, null)
//   - flat JSON-style arrays:  key: ["a", "b"]
//   - one level of nesting for the `exports:` block

export function parseFrontmatter(filepath: string): Record<string, unknown> {
  const content = readFileSync(filepath, "utf-8");
  // Read only the frontmatter block — stop at closing ---
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  return parseFrontmatterBlock(match[1]);
}

function parseFrontmatterBlock(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = block.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim() || line.startsWith("#")) { i++; continue; }

    // Nested section header — "exports:" with no value after the colon
    if (/^[a-zA-Z_][\w]*:\s*$/.test(line)) {
      const sectionKey = line.slice(0, line.indexOf(":")).trim();
      const nested: Record<string, unknown> = {};
      i++;
      while (i < lines.length && (lines[i].startsWith("  ") || lines[i].startsWith("\t") || lines[i] === "")) {
        const nline = lines[i];
        if (nline.trim()) {
          const ci = nline.indexOf(":");
          if (ci > 0) {
            const k = nline.slice(0, ci).trim();
            const v = nline.slice(ci + 1).trim();
            nested[k] = parseScalar(v);
          }
        }
        i++;
      }
      result[sectionKey] = nested;
      continue;
    }

    // Flat key: value
    const ci = line.indexOf(":");
    if (ci > 0) {
      const k = line.slice(0, ci).trim();
      const v = line.slice(ci + 1).trim();
      result[k] = parseScalar(v);
    }
    i++;
  }

  return result;
}

function parseScalar(v: string): unknown {
  if (!v) return null;
  if (v.startsWith("[")) {
    try { return JSON.parse(v); } catch { return v; }
  }
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  const n = Number(v);
  if (!isNaN(n) && v !== "") return n;
  return v;
}

export function extractExport(frontmatter: Record<string, unknown>, key: string): unknown {
  const exports = frontmatter["exports"] as Record<string, unknown> | undefined;
  return exports?.[key];
}

// ── Gate synthesis ────────────────────────────────────────────────────────────

export interface GateResult {
  verdict: "PASS" | "CONCERNS" | "FAIL" | "BLOCKED" | "WAIVED" | "HUMAN_JUDGMENT";
  score: number;        // 0–100 composite quality score
  reason: string;
  concerns?: string[];  // criteria that failed at concern severity (non-blocking)
  missing_ns?: string[];
  failed_criteria?: string[];
  conflicts?: string[];
  needs_arbitration: boolean;
  waiver_reason?: string;
  /** set when verdict=HUMAN_JUDGMENT — which namespace triggered escalation */
  human_judgment_ns?: string;
}

// ── Quality scoring ───────────────────────────────────────────────────────────

function computeScore(
  memory: Record<string, AgentFinding | null>,
  criteria: GateCriterion[]
): number {
  let totalWeight = 0;
  let earnedWeight = 0;

  for (const criterion of criteria) {
    const finding = memory[criterion.ns] as AgentFinding | null;
    if (!finding) continue;
    // not_applicable: criterion doesn't apply — exclude from scoring entirely
    if (finding.status === "not_applicable") continue;
    // Blocking criteria are worth 3× concern-severity criteria in the composite score
    const weight = criterion.severity === "concern" ? 1 : 3;
    totalWeight += weight;
    if (finding.status === "pass") {
      earnedWeight += weight;
    } else if (finding.status === "acknowledged") {
      earnedWeight += weight * 0.5;
    }
    // fail = 0 earned
  }

  if (totalWeight === 0) return 100;
  return Math.round((earnedWeight / totalWeight) * 100);
}

// ── Gate synthesis — 4-level verdict ─────────────────────────────────────────
// Verdict hierarchy:
//   WAIVED   — explicit waiver applied by a human (caller checks before calling this)
//   BLOCKED  — not all namespaces have reported yet
//   FAIL     — one or more blocking criteria not met
//   CONCERNS — all blocking criteria met; one or more concern-severity criteria not met
//   PASS     — all criteria met; score ≥ threshold

const SCORE_PASS_THRESHOLD = 80;

export function runGateSynthesis(config: StageConfig): GateResult {
  const memory = config.memory;
  const criteria = config.gate.criteria;

  // Block if any namespace hasn't reported yet
  const missing = Object.entries(memory)
    .filter(([, v]) => v === null)
    .map(([k]) => k);
  if (missing.length > 0) {
    return {
      verdict: "BLOCKED",
      score: 0,
      reason: `Waiting for sub-agent findings: ${missing.join(", ")}`,
      missing_ns: missing,
      needs_arbitration: false,
    };
  }

  // Human judgment escalation — any agent can flag this; doesn't consume fail_count
  const hjEntry = Object.entries(memory).find(
    ([, f]) => f !== null && (f as AgentFinding).requires_human_judgment
  );
  if (hjEntry) {
    return {
      verdict: "HUMAN_JUDGMENT",
      score: 0,
      reason: `Sub-agent "${hjEntry[0]}" flagged this stage as requiring human judgment before the gate can decide.`,
      needs_arbitration: false,
      human_judgment_ns: hjEntry[0],
    };
  }

  // Separate blocking vs concern-severity failures
  const blockingFailed: string[] = [];
  const concernFailed: string[] = [];

  for (const criterion of criteria) {
    const finding = memory[criterion.ns] as AgentFinding;
    if (!finding) { blockingFailed.push(`${criterion.ns}: no finding`); continue; }

    // not_applicable: skip criterion entirely — neither pass nor fail
    if (finding.status === "not_applicable") continue;

    const isBlocking = !criterion.severity || criterion.severity === "blocking";
    let met = true;

    if (criterion.must === "pass" && finding.status !== "pass") met = false;
    else if (criterion.must === "pass_or_acknowledge" && !["pass", "acknowledged"].includes(finding.status)) met = false;
    // warn_ok always passes

    if (!met) {
      if (isBlocking) {
        blockingFailed.push(`${criterion.ns}: status="${finding.status}", must="${criterion.must}"`);
      } else {
        concernFailed.push(`${criterion.ns}: status="${finding.status}" (concern-severity)`);
      }
    }
  }

  // Detect artifact conflicts
  const conflicts: string[] = [];
  const artifactMap = new Map<string, { ns: string; status: string }>();
  for (const [ns, finding] of Object.entries(memory)) {
    if (!finding) continue;
    for (const artifact of (finding as AgentFinding).artifacts) {
      const existing = artifactMap.get(artifact);
      if (existing && existing.status !== (finding as AgentFinding).status) {
        conflicts.push(`Conflict on "${artifact}": ${existing.ns}=${existing.status} vs ${ns}=${(finding as AgentFinding).status}`);
      }
      artifactMap.set(artifact, { ns, status: (finding as AgentFinding).status });
    }
  }

  const needsArbitration = conflicts.length >= config.gate.conflict_threshold;
  const score = computeScore(memory, criteria);

  if (blockingFailed.length > 0) {
    return {
      verdict: "FAIL",
      score,
      reason: `${blockingFailed.length} blocking criterion/criteria not met.`,
      failed_criteria: blockingFailed,
      concerns: concernFailed.length > 0 ? concernFailed : undefined,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      needs_arbitration: needsArbitration,
    };
  }

  if (concernFailed.length > 0 || score < SCORE_PASS_THRESHOLD) {
    return {
      verdict: "CONCERNS",
      score,
      reason: `Blocking criteria met but ${concernFailed.length} concern(s) noted${score < SCORE_PASS_THRESHOLD ? `; quality score ${score} < ${SCORE_PASS_THRESHOLD}` : ""}.`,
      concerns: concernFailed.length > 0 ? concernFailed : undefined,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
      needs_arbitration: needsArbitration,
    };
  }

  return {
    verdict: "PASS",
    score,
    reason: `All criteria met. Quality score: ${score}/100.`,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
    needs_arbitration: needsArbitration,
  };
}

// ── Task checkpoint I/O ───────────────────────────────────────────────────────

export function taskDir(projectRoot: string): string {
  const dir = join(projectRoot, ".sdlc-tasks");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function taskPath(projectRoot: string, taskId: string): string {
  return join(taskDir(projectRoot), `${taskId}.json`);
}

export function readTask(projectRoot: string, taskId: string): TaskCheckpoint | null {
  const p = taskPath(projectRoot, taskId);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as TaskCheckpoint;
}

export function writeTask(projectRoot: string, task: TaskCheckpoint): void {
  const p = taskPath(projectRoot, task.task_id);
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(task, null, 2), "utf-8");
  renameSync(tmp, p);
}

// ── Error diagnosis ───────────────────────────────────────────────────────────

// Classifies raw compiler/linter/test output into a structured payload.
// Returns only the relevant lines — never the full output.
export function diagnoseError(
  rawOutput: string,
  filePath: string
): DiagnosedError[] {
  const lines = rawOutput.split(/\r?\n/);
  const results: DiagnosedError[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // TypeScript: error TS2345: ... at src/foo.ts:42:10
    const tsMatch = line.match(/error (TS\d+):\s*(.+)/);
    if (tsMatch) {
      // Look for the file:line reference in surrounding lines
      const fileRef = findFileRef(lines, i, filePath);
      const key = `ts:${tsMatch[1]}:${fileRef?.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          kind: "type_error",
          severity: "error",
          file: fileRef?.file ?? filePath,
          line: fileRef?.line,
          col: fileRef?.col,
          message: `${tsMatch[1]}: ${tsMatch[2].trim()}`,
          raw_excerpt: extractExcerpt(lines, i, 3),
          fix_hint: tsHint(tsMatch[1]),
        });
      }
      continue;
    }

    // ESLint: src/foo.ts  42:5  error  no-unused-vars
    const eslintMatch = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(.+)$/);
    if (eslintMatch) {
      const key = `lint:${filePath}:${eslintMatch[1]}:${eslintMatch[5]}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          kind: "lint_error",
          severity: eslintMatch[3] as "error" | "warning",
          file: filePath,
          line: parseInt(eslintMatch[1]),
          col: parseInt(eslintMatch[2]),
          message: `${eslintMatch[5]}: ${eslintMatch[4].trim()}`,
          raw_excerpt: extractExcerpt(lines, i, 2),
        });
      }
      continue;
    }

    // Jest test failure: ● describe › test name
    const jestMatch = line.match(/^\s+●\s+(.+)$/);
    if (jestMatch) {
      const key = `test:${jestMatch[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          kind: "test_fail",
          severity: "error",
          file: filePath,
          message: jestMatch[1].trim(),
          raw_excerpt: extractExcerpt(lines, i, 6),
          fix_hint: "Check assertion at the marked line. Run the single test with --testNamePattern to isolate.",
        });
      }
      continue;
    }

    // Import / module not found
    if (line.includes("Cannot find module") || line.includes("Module not found")) {
      const modMatch = line.match(/['"]([^'"]+)['"]/);
      const key = `import:${modMatch?.[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          kind: "import_error",
          severity: "error",
          file: filePath,
          message: line.trim(),
          raw_excerpt: extractExcerpt(lines, i, 3),
          fix_hint: modMatch
            ? `Verify path "${modMatch[1]}" exists and is exported correctly.`
            : "Check import path and export.",
        });
      }
      continue;
    }

    // Syntax error: SyntaxError / Unexpected token
    if (line.match(/SyntaxError|Unexpected token|Unexpected end/)) {
      const key = `syntax:${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          kind: "syntax_error",
          severity: "error",
          file: filePath,
          message: line.trim(),
          raw_excerpt: extractExcerpt(lines, i, 4),
        });
      }
    }
  }

  // Fallback: no pattern matched — return first 8 non-empty lines
  if (results.length === 0) {
    const excerpt = lines.filter((l) => l.trim()).slice(0, 8).join("\n");
    results.push({
      kind: "unknown",
      severity: "error",
      file: filePath,
      message: "Unclassified error — see raw_excerpt",
      raw_excerpt: excerpt,
    });
  }

  return results;
}

function findFileRef(
  lines: string[],
  around: number,
  defaultFile: string
): { file: string; line?: number; col?: number } | null {
  // Search ±3 lines for a file:line:col reference
  const range = lines.slice(Math.max(0, around - 3), around + 4);
  for (const l of range) {
    const m = l.match(/([^\s(]+\.ts[x]?)[:(](\d+)(?:[,:](\d+))?/);
    if (m) return { file: m[1], line: parseInt(m[2]), col: m[3] ? parseInt(m[3]) : undefined };
  }
  return { file: defaultFile };
}

function extractExcerpt(lines: string[], center: number, radius: number): string {
  return lines
    .slice(Math.max(0, center - 1), center + radius)
    .join("\n")
    .trim();
}

function tsHint(code: string): string {
  const hints: Record<string, string> = {
    TS2345: "Type mismatch — check the argument type against the parameter type.",
    TS2304: "Cannot find name — check imports and ensure the symbol is exported.",
    TS2339: "Property does not exist — check the type definition or add the property.",
    TS2322: "Type not assignable — check the variable declaration type.",
    TS7006: "Parameter implicitly has 'any' — add explicit type annotation.",
    TS2307: "Cannot find module — check the import path and tsconfig paths.",
    TS2554: "Wrong number of arguments — check the function signature.",
  };
  return hints[code] ?? `See TypeScript docs for ${code}.`;
}
