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
          line: section.startLine + j + 2,
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
