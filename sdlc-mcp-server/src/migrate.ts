#!/usr/bin/env node
// sdlc-migrate — apply migrations to bring SDLC_VALIDATION.md up to the installed framework version
//
// Usage:
//   sdlc-migrate [--check]              Pre-flight: show what would change (no writes)
//   sdlc-migrate [--apply]              Apply migrations with backup
//   sdlc-migrate --to=X.Y.Z             Stop at version X.Y.Z instead of latest
//   sdlc-migrate --rollback             Restore from the most recent backup
//   sdlc-migrate --rollback=<timestamp> Restore from a specific backup
//   sdlc-migrate --list-backups         Show available backups
//   sdlc-migrate --project-root=PATH
//   sdlc-migrate --format=json|text
//
// Exit codes:
//   0 — success or up-to-date
//   1 — warnings only (e.g. unauthorized edits requiring user decisions)
//   2 — error (parse failure, missing backup, migration script error)

import { readFileSync, existsSync, copyFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseRegions, hashContent } from "./regions.js";
import { runMigrations, type MigrationScript, type RunResult } from "./migration.js";
import { deserializeRegistry } from "./template-generator.js";
import { resolveProjectRoot, findSdlcFile, readSdlcContent } from "./sdlc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Arg parsing ───────────────────────────────────────────────────────────────

interface Args {
  mode: "check" | "apply" | "rollback" | "list-backups";
  targetVersion?: string;
  rollbackTo?: string;
  projectRoot?: string;
  format: "json" | "text";
  yes: boolean;
}

function parseArgs(argv: string[]): Args {
  const has = (flag: string): boolean => argv.includes(flag);
  const get = (prefix: string): string | undefined =>
    argv.find((a) => a.startsWith(prefix))?.split("=")[1];

  let mode: Args["mode"] = "check";
  if (has("--apply")) mode = "apply";
  else if (has("--rollback") || argv.some((a) => a.startsWith("--rollback="))) mode = "rollback";
  else if (has("--list-backups")) mode = "list-backups";

  return {
    mode,
    targetVersion: get("--to="),
    rollbackTo: get("--rollback="),
    projectRoot: get("--project-root="),
    format: get("--format=") === "json" ? "json" : "text",
    yes: has("--yes") || has("-y"),
  };
}

// ── Migration script loader ────────────────────────────────────────────────────

async function loadMigrationScripts(): Promise<MigrationScript[]> {
  const migrationsDir = resolve(__dirname, "migrations");
  if (!existsSync(migrationsDir)) return [];

  const files = readdirSync(migrationsDir).filter(
    (f) => /\.(js|ts)$/.test(f) && !f.endsWith(".d.ts"),
  );

  const scripts: MigrationScript[] = [];
  for (const file of files) {
    const fullPath = join(migrationsDir, file);
    try {
      const mod = await import(pathToFileURL(fullPath).href);
      if (mod.migration) scripts.push(mod.migration as MigrationScript);
    } catch (e) {
      process.stderr.write(`Warning: Failed to load migration ${file}: ${String(e)}\n`);
    }
  }

  return scripts;
}

// ── Version detection ──────────────────────────────────────────────────────────

function getClientVersion(sdlcContent: string, projectRoot: string): string {
  // 1. Try parsing the <!-- SDLC:version --> marker
  const parsed = parseRegions(sdlcContent);
  if (parsed.frameworkVersion) return parsed.frameworkVersion;

  // 2. Try .sdlc-state.json
  const statePath = join(projectRoot, ".sdlc-state.json");
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, "utf-8"));
      if (state.sdlc_framework_version) return state.sdlc_framework_version as string;
    } catch { /* fall through */ }
  }

  // 3. Assume 1.0.0 (pre-region-markers)
  return "1.0.0";
}

const REGISTRY_CANDIDATES = [
  join(__dirname, "../../plugin/template/registry.json"),
  join(__dirname, "../template/registry.json"),
];

function resolveRegistryPath(): string | null {
  for (const p of REGISTRY_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

function getInstalledVersion(): string {
  const p = resolveRegistryPath();
  if (!p) return "1.0.0";
  try {
    return deserializeRegistry(readFileSync(p, "utf-8")).version;
  } catch { return "1.0.0"; }
}

// ── Unauthorized-edit detection ───────────────────────────────────────────────

interface UnauthorizedEdit {
  regionId: string;
  startLine: number;
  recordedHash: string;
  currentHash: string;
  content: string;
}

function detectUnauthorizedEdits(sdlcContent: string): UnauthorizedEdit[] {
  const parsed = parseRegions(sdlcContent);
  const out: UnauthorizedEdit[] = [];
  for (const region of parsed.regions) {
    if (region.type === "framework" && region.dirty && region.hash) {
      out.push({
        regionId: region.id,
        startLine: region.startLine,
        recordedHash: region.hash,
        currentHash: hashContent(region.content),
        content: region.content,
      });
    }
  }
  return out;
}

// ── Backup discovery ──────────────────────────────────────────────────────────

interface Backup {
  timestamp: string;
  path: string;
  sdlcFile: string;
  stateFile?: string;
  ageMs: number;
}

function listBackups(projectRoot: string): Backup[] {
  const backupRoot = join(projectRoot, ".sdlc-backups");
  if (!existsSync(backupRoot)) return [];

  const entries = readdirSync(backupRoot);
  const backups: Backup[] = [];
  const now = Date.now();

  for (const entry of entries) {
    const dir = join(backupRoot, entry);
    if (!statSync(dir).isDirectory()) continue;
    const sdlcFile = join(dir, "SDLC_VALIDATION.md");
    if (!existsSync(sdlcFile)) continue;
    const stateFile = join(dir, ".sdlc-state.json");
    backups.push({
      timestamp: entry,
      path: dir,
      sdlcFile,
      stateFile: existsSync(stateFile) ? stateFile : undefined,
      ageMs: now - statSync(dir).mtimeMs,
    });
  }

  // Most recent first
  return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function formatAge(ageMs: number): string {
  const sec = Math.floor(ageMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

// ── Rollback ──────────────────────────────────────────────────────────────────

function rollback(projectRoot: string, timestamp: string | undefined, format: string): number {
  const backups = listBackups(projectRoot);
  if (backups.length === 0) {
    const msg = "No backups found in .sdlc-backups/.";
    if (format === "json") process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    else process.stderr.write(msg + "\n");
    return 2;
  }

  const target = timestamp
    ? backups.find((b) => b.timestamp === timestamp)
    : backups[0];

  if (!target) {
    const msg = `Backup "${timestamp}" not found. Available: ${backups.map((b) => b.timestamp).join(", ")}`;
    if (format === "json") process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    else process.stderr.write(msg + "\n");
    return 2;
  }

  // 30-day retention guard
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  if (target.ageMs > MAX_AGE_MS) {
    const msg =
      `Backup ${target.timestamp} is older than 30 days (${formatAge(target.ageMs)}) — ` +
      `rollback is not supported beyond the retention window.`;
    if (format === "json") process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    else process.stderr.write(msg + "\n");
    return 2;
  }

  // Find the live files
  const liveSdlc = findSdlcFile(projectRoot);
  const liveState = join(projectRoot, ".sdlc-state.json");

  // Before overwriting, take a backup of the current state (so rollback is itself reversible)
  const preRollbackTs = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const preRollbackDir = join(projectRoot, ".sdlc-backups", `pre-rollback-${preRollbackTs}`);
  mkdirSync(preRollbackDir, { recursive: true });
  copyFileSync(liveSdlc, join(preRollbackDir, "SDLC_VALIDATION.md"));
  if (existsSync(liveState)) {
    copyFileSync(liveState, join(preRollbackDir, ".sdlc-state.json"));
  }

  // Restore from backup
  copyFileSync(target.sdlcFile, liveSdlc);
  if (target.stateFile && existsSync(target.stateFile)) {
    copyFileSync(target.stateFile, liveState);
  }

  const result = {
    restored_from: target.timestamp,
    restored_age: formatAge(target.ageMs),
    pre_rollback_backup: preRollbackDir,
    files_restored: target.stateFile ? ["SDLC_VALIDATION.md", ".sdlc-state.json"] : ["SDLC_VALIDATION.md"],
  };

  if (format === "json") {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(
      `Rolled back to ${target.timestamp} (${formatAge(target.ageMs)})\n` +
      `Files restored: ${result.files_restored.join(", ")}\n` +
      `Current state backed up to: ${preRollbackDir}\n`,
    );
  }
  return 0;
}

// ── Text renderers ────────────────────────────────────────────────────────────

function renderPreflight(opts: {
  clientVersion: string;
  installedVersion: string;
  applicableScripts: MigrationScript[];
  unauthorizedEdits: UnauthorizedEdit[];
  targetVersion: string;
}): string {
  const { clientVersion, installedVersion, applicableScripts, unauthorizedEdits, targetVersion } = opts;
  const lines: string[] = [
    `SDLC Migrate — Pre-flight`,
    `${"─".repeat(60)}`,
    `Currently installed: v${installedVersion}`,
    `Client document:     v${clientVersion}`,
    `Target version:      v${targetVersion}`,
    "",
  ];

  if (applicableScripts.length === 0) {
    lines.push("✓ No migrations to apply — document is at the target version.");
    return lines.join("\n");
  }

  lines.push(`Upgrade path (${applicableScripts.length} step${applicableScripts.length === 1 ? "" : "s"}):`);
  for (const s of applicableScripts) {
    lines.push(`  v${s.from} → v${s.to}  ${s.description}`);
  }
  lines.push("");

  if (unauthorizedEdits.length > 0) {
    lines.push(`⚠ Unauthorized edits detected in ${unauthorizedEdits.length} framework region(s):`);
    for (const e of unauthorizedEdits) {
      lines.push(`  - ${e.regionId} (line ${e.startLine})`);
    }
    lines.push("");
    lines.push("Each of these will be wrapped as a user-override during migration.");
    lines.push("The framework content will be updated; your edits will be preserved as overrides.");
    lines.push("");
  }

  lines.push(`Run with --apply to proceed. A backup will be written to .sdlc-backups/<timestamp>/`);
  return lines.join("\n");
}

function renderApplyResult(result: RunResult): string {
  const lines: string[] = [
    `SDLC Migrate — Applied`,
    `${"─".repeat(60)}`,
  ];

  if (result.steps.length === 0) {
    lines.push("✓ Already at target version — no changes.");
    return lines.join("\n");
  }

  for (const step of result.steps) {
    lines.push(`v${step.from} → v${step.to}`);
    for (const c of step.changes) lines.push(`  • ${c}`);
    if (step.warnings.length > 0) {
      for (const w of step.warnings) {
        lines.push(`  ⚠ ${w}`);
      }
    }
  }

  lines.push("");
  lines.push(`Final version: v${result.finalVersion}`);
  if (result.backupPath) lines.push(`Backup:        ${result.backupPath}`);
  lines.push("");
  lines.push(`Rollback within 30 days: sdlc-migrate --rollback`);

  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = resolveProjectRoot(args.projectRoot);

  // List backups
  if (args.mode === "list-backups") {
    const backups = listBackups(projectRoot);
    if (args.format === "json") {
      process.stdout.write(JSON.stringify(backups, null, 2) + "\n");
    } else {
      if (backups.length === 0) {
        process.stdout.write("No backups found.\n");
      } else {
        process.stdout.write("Backups available for rollback:\n");
        for (const b of backups) {
          process.stdout.write(`  ${b.timestamp}  ${formatAge(b.ageMs).padStart(8)}  ${b.path}\n`);
        }
      }
    }
    process.exit(0);
  }

  // Rollback
  if (args.mode === "rollback") {
    const code = rollback(projectRoot, args.rollbackTo, args.format);
    process.exit(code);
  }

  // Check or apply — both need scripts loaded and versions resolved
  const sdlcPath = findSdlcFile(projectRoot);
  const sdlcContent = readSdlcContent(sdlcPath);

  const clientVersion = getClientVersion(sdlcContent, projectRoot);
  const installedVersion = getInstalledVersion();
  const targetVersion = args.targetVersion ?? installedVersion;

  const allScripts = await loadMigrationScripts();
  const applicableScripts = allScripts
    .filter((s) => compareVersions(s.to, clientVersion) > 0 && compareVersions(s.to, targetVersion) <= 0)
    .sort((a, b) => compareVersions(a.to, b.to));

  const unauthorizedEdits = detectUnauthorizedEdits(sdlcContent);

  // Pre-flight check
  if (args.mode === "check") {
    if (args.format === "json") {
      process.stdout.write(JSON.stringify({
        client_version: clientVersion,
        installed_version: installedVersion,
        target_version: targetVersion,
        applicable_scripts: applicableScripts.map((s) => ({ from: s.from, to: s.to, description: s.description })),
        unauthorized_edits: unauthorizedEdits.map((e) => ({
          region_id: e.regionId,
          line: e.startLine,
          recorded_hash: e.recordedHash,
        })),
      }, null, 2) + "\n");
    } else {
      process.stdout.write(renderPreflight({
        clientVersion, installedVersion, applicableScripts, unauthorizedEdits, targetVersion,
      }) + "\n");
    }
    process.exit(unauthorizedEdits.length > 0 ? 1 : 0);
  }

  // Apply
  const registryPath = resolveRegistryPath() ?? join(__dirname, "../../plugin/template/registry.json");

  let result: RunResult;
  try {
    result = await runMigrations({
      projectRoot,
      sdlcPath,
      fromVersion: clientVersion,
      toVersion: targetVersion,
      scripts: allScripts,
      registryPath,
      dryRun: false,
    });
  } catch (err) {
    if (args.format === "json") {
      process.stdout.write(JSON.stringify({ error: String(err) }) + "\n");
    } else {
      process.stderr.write(`Migration failed: ${String(err)}\n`);
    }
    process.exit(2);
  }

  if (args.format === "json") {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    process.stdout.write(renderApplyResult(result) + "\n");
  }

  process.exit(result.allWarnings.length > 0 ? 1 : 0);
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(2);
});
