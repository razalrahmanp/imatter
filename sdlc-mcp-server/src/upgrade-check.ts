#!/usr/bin/env node
// sdlc upgrade --check
//
// Usage:
//   sdlc-upgrade-check [--format=json|text] [--project-root=PATH] [--registry=PATH]
//
// Exit codes:
//   0 — no issues (up-to-date, no dirty regions, no stale overrides)
//   1 — warnings only (stale overrides, untagged content)
//   2 — hard issues (dirty framework regions, integrity errors, registry missing)

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRegions, hashContent } from "./regions.js";
import { deserializeRegistry, type CanonicalRegistry } from "./template-generator.js";
import { resolveProjectRoot, findSdlcFile, readSdlcContent } from "./sdlc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Types ──────────────────────────────────────────────────────────────────────

type Severity = "ok" | "warning" | "error";

interface RegionReport {
  id: string;
  severity: Severity;
  code: string;
  message: string;
  line?: number;
  detail?: string;
}

interface CheckOutput {
  project_root: string;
  sdlc_file: string;
  framework_version: string;
  client_version?: string;
  checked_at: string;
  is_fully_tagged: boolean;
  region_reports: RegionReport[];
  untagged_blocks: number;
  summary: {
    ok: number;
    warnings: number;
    errors: number;
  };
}

// ── Arg parser ─────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  format: "json" | "text";
  projectRoot?: string;
  registryPath?: string;
} {
  const format =
    argv.find((a) => a.startsWith("--format="))?.split("=")[1] === "json"
      ? "json"
      : "text";
  const projectRoot = argv.find((a) => a.startsWith("--project-root="))?.split("=")[1];
  const registryPath = argv.find((a) => a.startsWith("--registry="))?.split("=")[1];
  return { format, projectRoot, registryPath };
}

// ── Registry loader ────────────────────────────────────────────────────────────

function loadRegistry(registryPath?: string): { version: string; registry: CanonicalRegistry } {
  const candidates = [
    registryPath && resolve(registryPath),
    join(__dirname, "../../plugin/template/registry.json"),
    join(__dirname, "../template/registry.json"),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return deserializeRegistry(readFileSync(p, "utf-8"));
      } catch (e) {
        throw new Error(`Failed to parse registry at ${p}: ${String(e)}`);
      }
    }
  }
  throw new Error(
    `No registry.json found. Run 'npx tsx src/generate-template.ts' to generate it.`,
  );
}

// ── Core check ────────────────────────────────────────────────────────────────

function runCheck(
  sdlcContent: string,
  registry: CanonicalRegistry,
  frameworkVersion: string,
): Omit<CheckOutput, "project_root" | "sdlc_file" | "checked_at" | "framework_version"> {
  const parsed = parseRegions(sdlcContent);
  const reports: RegionReport[] = [];

  // 1. Parse errors — hard failures
  for (const err of parsed.errors) {
    reports.push({
      id: err.id ?? "(unknown)",
      severity: "error",
      code: err.code,
      message: err.message,
      line: err.line,
    });
  }

  // 2. Parse warnings (HASH_MISMATCH, OVERRIDE_STALE, etc.)
  for (const warn of parsed.warnings) {
    const severity: Severity =
      warn.code === "HASH_MISMATCH" ? "error" : "warning";
    reports.push({
      id: warn.id ?? "(unknown)",
      severity,
      code: warn.code,
      message: warn.message,
      line: warn.line,
    });
  }

  // 3. Cross-check against registry — find regions present in registry but missing from doc
  const docFrameworkIds = new Set(
    parsed.regions
      .filter((r) => r.type === "framework")
      .map((r) => r.id),
  );

  for (const [id, canonical] of registry) {
    if (!docFrameworkIds.has(id)) {
      reports.push({
        id,
        severity: "warning",
        code: "REGION_MISSING",
        message: `Framework region "${id}" (since v${canonical.since}) is absent from this document.`,
        detail:
          `This region was introduced in framework v${canonical.since}. ` +
          `Run 'sdlc upgrade --apply' to add it.`,
      });
    }
  }

  // 4. Check framework regions that exist — compare hash against registry
  for (const region of parsed.regions) {
    if (region.type !== "framework") continue;

    const canonical = registry.get(region.id);
    if (!canonical) {
      // Region in doc but not in registry — custom or from future version
      reports.push({
        id: region.id,
        severity: "warning",
        code: "REGION_UNKNOWN",
        message: `Framework region "${region.id}" is not in the installed registry.`,
        line: region.startLine,
        detail: "This may be a custom framework region or from a newer framework version.",
      });
      continue;
    }

    // Already reported by parser if dirty — skip duplicate
    if (region.dirty) continue;

    // Hash matches registry — OK
    const liveHash = hashContent(region.content);
    if (liveHash === canonical.hash) {
      reports.push({
        id: region.id,
        severity: "ok",
        code: "REGION_CLEAN",
        message: `Framework region "${region.id}" matches registry hash.`,
        line: region.startLine,
      });
    } else if (!region.hash) {
      // No hash attribute — can't verify
      reports.push({
        id: region.id,
        severity: "warning",
        code: "MISSING_HASH",
        message: `Framework region "${region.id}" has no hash attribute — cannot verify.`,
        line: region.startLine,
      });
    }
  }

  // 5. Untagged content
  if (!parsed.isFullyTagged && parsed.untagged.length > 0) {
    reports.push({
      id: "(document)",
      severity: "warning",
      code: "UNTAGGED_CONTENT",
      message: `${parsed.untagged.length} block(s) of content are outside any region marker.`,
      detail:
        `This document has not been fully migrated to the region-marker format. ` +
        `Run 'sdlc upgrade --apply' to inject markers.`,
    });
  }

  const summary = {
    ok: reports.filter((r) => r.severity === "ok").length,
    warnings: reports.filter((r) => r.severity === "warning").length,
    errors: reports.filter((r) => r.severity === "error").length,
  };

  return {
    client_version: parsed.frameworkVersion,
    is_fully_tagged: parsed.isFullyTagged,
    region_reports: reports,
    untagged_blocks: parsed.untagged.length,
    summary,
  };
}

// ── Text renderer ─────────────────────────────────────────────────────────────

function renderText(out: CheckOutput): string {
  const lines: string[] = [
    `SDLC Upgrade Check — ${out.sdlc_file}`,
    `Framework: v${out.framework_version} | Client doc: ${out.client_version ?? "unversioned"} | ${out.checked_at}`,
    `${"─".repeat(60)}`,
  ];

  const errors = out.region_reports.filter((r) => r.severity === "error");
  const warnings = out.region_reports.filter((r) => r.severity === "warning");
  const ok = out.region_reports.filter((r) => r.severity === "ok");

  if (errors.length > 0) {
    lines.push(`\nERRORS (${errors.length}):`);
    for (const r of errors) {
      lines.push(`  ✗ [${r.code}] ${r.message}${r.line ? ` (line ${r.line})` : ""}`);
      if (r.detail) lines.push(`    ${r.detail}`);
    }
  }

  if (warnings.length > 0) {
    lines.push(`\nWARNINGS (${warnings.length}):`);
    for (const r of warnings) {
      lines.push(`  ⚠ [${r.code}] ${r.message}${r.line ? ` (line ${r.line})` : ""}`);
      if (r.detail) lines.push(`    ${r.detail}`);
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    lines.push(`\n✓ All ${ok.length} framework regions are clean.`);
  }

  lines.push(
    `\n${"─".repeat(60)}`,
    `OK: ${out.summary.ok}  WARNINGS: ${out.summary.warnings}  ERRORS: ${out.summary.errors}`,
    out.is_fully_tagged
      ? "Document is fully tagged."
      : `Document has ${out.untagged_blocks} untagged block(s) — run 'sdlc upgrade --apply'.`,
  );

  return lines.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { format, projectRoot, registryPath } = parseArgs(process.argv.slice(2));

  let root: string;
  let sdlcPath: string;
  let sdlcContent: string;

  try {
    root = resolveProjectRoot(projectRoot);
    sdlcPath = findSdlcFile(root);
    sdlcContent = readSdlcContent(sdlcPath);
  } catch (err) {
    const msg = `ERROR: ${String(err)}`;
    if (format === "json") process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    else process.stderr.write(msg + "\n");
    process.exit(2);
  }

  let frameworkVersion: string;
  let registry: CanonicalRegistry;

  try {
    const loaded = loadRegistry(registryPath);
    frameworkVersion = loaded.version;
    registry = loaded.registry;
  } catch (err) {
    const msg = `ERROR loading registry: ${String(err)}`;
    if (format === "json") process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    else process.stderr.write(msg + "\n");
    process.exit(2);
  }

  const result = runCheck(sdlcContent, registry, frameworkVersion);

  const output: CheckOutput = {
    project_root: root!,
    sdlc_file: sdlcPath!,
    framework_version: frameworkVersion!,
    checked_at: new Date().toISOString(),
    ...result,
  };

  if (format === "json") {
    process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  } else {
    process.stdout.write(renderText(output) + "\n");
  }

  if (output.summary.errors > 0) process.exit(2);
  if (output.summary.warnings > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(2);
});
