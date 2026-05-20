import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { parseRegions, serializeRegions, hashContent, type Region, type ParseResult } from "./regions.js";
import { deserializeRegistry, type CanonicalRegistry } from "./template-generator.js";
import { readSdlcContent } from "./sdlc.js";

// ── Migration script interface ────────────────────────────────────────────────
//
// Every file in migrations/ must export a MigrationScript object.
// The runner calls apply() with a mutable ParseResult and the raw document lines.
// apply() returns the new document string.
//
// Constraints the migration MUST honour:
//   - Never modify region.content for type="user" or type="user-override" regions.
//   - Never change region IDs.
//   - May add new framework regions (insert into lines).
//   - May update framework region content (triggers hash recompute in serializeRegions).
//   - May add new user sibling regions (empty, never pre-filled).
//   - Must return a string parseable by parseRegions without new errors.

export interface MigrationContext {
  parsed: ParseResult;
  lines: string[];          // original document lines, 1-indexed via lines[i-1]
  fromVersion: string;
  toVersion: string;
  projectRoot: string;
}

export interface MigrationResult {
  newContent: string;       // the full document after migration
  changes: string[];        // human-readable list of what changed
  warnings: string[];       // non-fatal issues for the user to review
}

export interface MigrationScript {
  from: string;             // semver range the script handles, e.g. "1.0.x" or ">=1.0.0 <1.1.0"
  to: string;               // exact version this script produces
  description: string;      // one-line summary shown during upgrade --check pre-flight
  apply(ctx: MigrationContext): MigrationResult;
}

// ── Migration runner ──────────────────────────────────────────────────────────

export interface RunOptions {
  projectRoot: string;
  sdlcPath: string;
  fromVersion: string;
  toVersion: string;
  scripts: MigrationScript[];
  registryPath: string;
  dryRun?: boolean;
}

export interface RunResult {
  steps: StepResult[];
  finalContent: string;
  finalVersion: string;
  backupPath: string | null;
  allChanges: string[];
  allWarnings: string[];
}

interface StepResult {
  from: string;
  to: string;
  description: string;
  changes: string[];
  warnings: string[];
  skipped: boolean;
}

export async function runMigrations(opts: RunOptions): Promise<RunResult> {
  const {
    projectRoot, sdlcPath, fromVersion, toVersion,
    scripts, registryPath, dryRun = false,
  } = opts;

  // Sort scripts by toVersion ascending
  const ordered = [...scripts].sort((a, b) => compareVersions(a.to, b.to));

  // Filter to scripts applicable to this upgrade path
  const applicable = ordered.filter(
    (s) => compareVersions(s.to, fromVersion) > 0 &&
            compareVersions(s.to, toVersion) <= 0,
  );

  if (applicable.length === 0) {
    return {
      steps: [],
      finalContent: readSdlcContent(sdlcPath),
      finalVersion: fromVersion,
      backupPath: null,
      allChanges: [],
      allWarnings: [],
    };
  }

  // Back up before touching anything
  let backupPath: string | null = null;
  if (!dryRun) {
    backupPath = createBackup(projectRoot, sdlcPath);
  }

  let currentContent = readSdlcContent(sdlcPath);
  let currentVersion = fromVersion;
  const steps: StepResult[] = [];
  const allChanges: string[] = [];
  const allWarnings: string[] = [];

  for (const script of applicable) {
    const parsed = parseRegions(currentContent);
    const lines = currentContent.split("\n");

    if (parsed.errors.length > 0 && !dryRun) {
      allWarnings.push(
        `Parse errors before applying ${script.to} migration — proceeding with caution:\n` +
        parsed.errors.map((e) => `  ${e.message}`).join("\n"),
      );
    }

    const ctx: MigrationContext = {
      parsed,
      lines,
      fromVersion: currentVersion,
      toVersion: script.to,
      projectRoot,
    };

    const result = script.apply(ctx);
    steps.push({
      from: currentVersion,
      to: script.to,
      description: script.description,
      changes: result.changes,
      warnings: result.warnings,
      skipped: false,
    });
    allChanges.push(...result.changes);
    allWarnings.push(...result.warnings);

    // Verify the output is parseable before accepting
    const check = parseRegions(result.newContent);
    if (check.errors.length > 0) {
      allWarnings.push(
        `Migration to ${script.to} produced parse errors — output may be malformed:\n` +
        check.errors.map((e) => `  ${e.message}`).join("\n"),
      );
    }

    currentContent = result.newContent;
    currentVersion = script.to;
  }

  if (!dryRun) {
    writeFileSync(sdlcPath, currentContent, "utf-8");
  }

  return {
    steps,
    finalContent: currentContent,
    finalVersion: currentVersion,
    backupPath,
    allChanges,
    allWarnings,
  };
}

// ── Region mutation helpers (for use inside migration scripts) ─────────────────

/**
 * Replace a framework region's content.
 * Leaves user and user-override regions untouched.
 * Returns the new document string with the hash recomputed.
 */
export function replaceFrameworkRegion(
  content: string,
  regionId: string,
  newRegionContent: string,
): string {
  const parsed = parseRegions(content);
  const region = parsed.regions.find(
    (r) => r.id === regionId && r.type === "framework",
  );
  if (!region) {
    throw new Error(`Framework region "${regionId}" not found — cannot replace.`);
  }
  if (region.locked) {
    throw new Error(
      `Framework region "${regionId}" is locked — use --force or unlock before migrating.`,
    );
  }
  region.content = newRegionContent.trim();
  const lines = content.split("\n");
  return serializeRegions(lines, parsed.regions);
}

/**
 * Insert a new region pair (framework + optional user sibling) after a named anchor region.
 * Used when a migration adds a new section to the document.
 */
export function insertRegionAfter(
  content: string,
  afterId: string,
  newRegion: {
    id: string;
    type: "framework" | "user";
    since: string;
    regionContent: string;
    userSiblingId?: string;
  },
): string {
  const parsed = parseRegions(content);
  const anchor = parsed.regions.find((r) => r.id === afterId);
  if (!anchor) {
    throw new Error(`Anchor region "${afterId}" not found — cannot insert after it.`);
  }

  const lines = content.split("\n");
  const insertAt = anchor.endLine; // insert after the closing tag line (0-indexed = endLine)

  const hash = hashContent(newRegion.regionContent);
  const openTag =
    newRegion.type === "framework"
      ? `<!-- SDLC:start type="framework" id="${newRegion.id}" since="${newRegion.since}" hash="${hash}" -->`
      : `<!-- SDLC:start type="user" id="${newRegion.id}" -->`;
  const closeTag = `<!-- SDLC:end id="${newRegion.id}" -->`;

  const newLines = [
    "",
    openTag,
    newRegion.regionContent,
    closeTag,
  ];

  if (newRegion.userSiblingId) {
    newLines.push(
      `<!-- SDLC:start type="user" id="${newRegion.userSiblingId}" -->`,
      `<!-- SDLC:end id="${newRegion.userSiblingId}" -->`,
    );
  }

  lines.splice(insertAt, 0, ...newLines);
  return lines.join("\n");
}

/**
 * Check whether a region exists and is clean (not dirty, not stale).
 * Used by migration scripts to decide whether to apply a change.
 */
export function regionStatus(
  parsed: ParseResult,
  regionId: string,
): "clean" | "dirty" | "missing" | "user-override" {
  const region = parsed.regions.find((r) => r.id === regionId);
  if (!region) return "missing";
  if (region.type === "user-override") return "user-override";
  if (region.dirty) return "dirty";
  return "clean";
}

// ── Upgrade registry updater ───────────────────────────────────────────────────
//
// After a migration completes, re-derive the canonical hashes from the new
// registry.json and update any framework regions whose hash has changed.

export function applyRegistryUpdate(
  content: string,
  registryPath: string,
): { newContent: string; updated: string[] } {
  if (!existsSync(registryPath)) {
    return { newContent: content, updated: [] };
  }

  const { registry } = deserializeRegistry(readFileSync(registryPath, "utf-8"));
  const parsed = parseRegions(content);
  const updated: string[] = [];

  for (const region of parsed.regions) {
    if (region.type !== "framework") continue;
    const canonical = registry.get(region.id);
    if (!canonical) continue;
    // Replace with canonical content if the hash changed (framework was updated)
    if (canonical.hash !== hashContent(region.content)) {
      region.content = canonical.content;
      updated.push(region.id);
    }
  }

  if (updated.length === 0) return { newContent: content, updated: [] };

  const lines = content.split("\n");
  return { newContent: serializeRegions(lines, parsed.regions), updated };
}

// ── Backup helper ─────────────────────────────────────────────────────────────

function createBackup(projectRoot: string, sdlcPath: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(projectRoot, ".sdlc-backups", ts);
  mkdirSync(backupDir, { recursive: true });
  const dest = join(backupDir, "SDLC_VALIDATION.md");
  copyFileSync(sdlcPath, dest);

  // Also backup state if present
  const statePath = join(projectRoot, ".sdlc-state.json");
  if (existsSync(statePath)) copyFileSync(statePath, join(backupDir, ".sdlc-state.json"));

  return backupDir;
}

// ── Semver comparison (no dependencies) ──────────────────────────────────────

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
