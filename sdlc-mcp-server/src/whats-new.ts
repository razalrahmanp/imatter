#!/usr/bin/env node
// sdlc-whats-new — show what changed between the client's framework version
// and the installed framework version.
//
// Parses CHANGELOG.md and renders the entries newer than the client's version.
// Use after `sdlc-migrate --apply` to surface new capabilities.
//
// Usage:
//   sdlc-whats-new                       Show changes since the client's current version
//   sdlc-whats-new --since=X.Y.Z         Show changes since a specific version
//   sdlc-whats-new --to=X.Y.Z            Stop at a specific version
//   sdlc-whats-new --format=json|text    Output format (default: text)
//   sdlc-whats-new --project-root=PATH
//
// Exit codes:
//   0 — output rendered (even if no new changes)
//   2 — CHANGELOG.md not found or parse error

import { readFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRegions } from "./regions.js";
import { deserializeRegistry } from "./template-generator.js";
import { resolveProjectRoot, findSdlcFile, readSdlcContent } from "./sdlc.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Args ──────────────────────────────────────────────────────────────────────

interface Args {
  since?: string;
  to?: string;
  projectRoot?: string;
  format: "json" | "text";
}

function parseArgs(argv: string[]): Args {
  const get = (p: string): string | undefined =>
    argv.find((a) => a.startsWith(p))?.split("=")[1];
  return {
    since: get("--since="),
    to: get("--to="),
    projectRoot: get("--project-root="),
    format: get("--format=") === "json" ? "json" : "text",
  };
}

// ── Changelog locator + parser ────────────────────────────────────────────────

function findChangelog(): string | null {
  const candidates = [
    resolve(__dirname, "../../CHANGELOG.md"),
    resolve(__dirname, "../CHANGELOG.md"),
    resolve(process.cwd(), "CHANGELOG.md"),
  ];
  for (const p of candidates) if (existsSync(p)) return p;
  return null;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  headline: string;
  body: string;
}

export function parseChangelog(content: string): ChangelogEntry[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  let bodyLines: string[] = [];

  // Matches: ## [1.4.0] — 2026-05-20 — Region marker foundation
  // Also accepts plain hyphen, en-dash, em-dash separators
  const headerRe = /^##\s+\[?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\]?\s*[—–-]\s*(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+)$/;

  for (const line of lines) {
    const m = headerRe.exec(line);
    if (m) {
      if (current) {
        current.body = bodyLines.join("\n").trim();
        entries.push(current);
      }
      current = { version: m[1], date: m[2], headline: m[3].trim(), body: "" };
      bodyLines = [];
    } else if (current) {
      bodyLines.push(line);
    }
  }
  if (current) {
    current.body = bodyLines.join("\n").trim();
    entries.push(current);
  }
  return entries;
}

// ── Version detection ─────────────────────────────────────────────────────────

function getClientVersion(projectRoot: string): string | null {
  try {
    const sdlcPath = findSdlcFile(projectRoot);
    const content = readSdlcContent(sdlcPath);
    const parsed = parseRegions(content);
    if (parsed.frameworkVersion) return parsed.frameworkVersion;
  } catch { /* fall through */ }

  const statePath = join(projectRoot, ".sdlc-state.json");
  if (existsSync(statePath)) {
    try {
      const state = JSON.parse(readFileSync(statePath, "utf-8"));
      if (state.sdlc_framework_version) return state.sdlc_framework_version as string;
    } catch { /* fall through */ }
  }
  return null;
}

function getInstalledVersion(): string {
  const candidates = [
    join(__dirname, "../../plugin/template/registry.json"),
    join(__dirname, "../template/registry.json"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try {
        return deserializeRegistry(readFileSync(p, "utf-8")).version;
      } catch { /* fall through */ }
    }
  }
  return "1.0.0";
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.+-]/).map((s) => parseInt(s, 10) || 0);
  const pb = b.split(/[.+-]/).map((s) => parseInt(s, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// ── Filter + render ───────────────────────────────────────────────────────────

function filterEntries(
  entries: ChangelogEntry[],
  since: string,
  to: string,
): ChangelogEntry[] {
  return entries.filter((e) => {
    const newerThanSince = compareVersions(e.version, since) > 0;
    const noNewerThanTo = compareVersions(e.version, to) <= 0;
    return newerThanSince && noNewerThanTo;
  });
}

function renderText(entries: ChangelogEntry[], since: string, to: string): string {
  if (entries.length === 0) {
    return `What's new — v${since} → v${to}\n${"─".repeat(60)}\nNo changes (already at target version).`;
  }

  const lines: string[] = [
    `What's new — v${since} → v${to}`,
    "─".repeat(60),
    `${entries.length} release${entries.length === 1 ? "" : "s"} since v${since}.`,
    "",
  ];

  for (const e of entries) {
    lines.push(`## v${e.version}  (${e.date})  — ${e.headline}`);
    lines.push("");
    lines.push(e.body);
    lines.push("");
    lines.push("─".repeat(60));
    lines.push("");
  }

  lines.push("");
  lines.push("Tip: run `sdlc-migrate --check` to confirm your project is fully migrated to the latest version.");
  return lines.join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────────

// Detect direct CLI invocation vs import
function isCliInvocation(): boolean {
  // process.argv[1] holds the path to the script being run
  const invokedPath = process.argv[1] ?? "";
  return invokedPath.endsWith("whats-new.js") || invokedPath.endsWith("whats-new.ts");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = resolveProjectRoot(args.projectRoot);

  const changelogPath = findChangelog();
  if (!changelogPath) {
    const msg = "CHANGELOG.md not found";
    if (args.format === "json") process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    else process.stderr.write(msg + "\n");
    process.exit(2);
  }

  let entries: ChangelogEntry[];
  try {
    entries = parseChangelog(readFileSync(changelogPath, "utf-8"));
  } catch (err) {
    const msg = `Failed to parse CHANGELOG.md: ${String(err)}`;
    if (args.format === "json") process.stdout.write(JSON.stringify({ error: msg }) + "\n");
    else process.stderr.write(msg + "\n");
    process.exit(2);
  }

  const since = args.since ?? getClientVersion(projectRoot) ?? "0.0.0";
  const to = args.to ?? getInstalledVersion();

  const filtered = filterEntries(entries, since, to);

  if (args.format === "json") {
    process.stdout.write(JSON.stringify({
      since,
      to,
      entries: filtered,
    }, null, 2) + "\n");
  } else {
    process.stdout.write(renderText(filtered, since, to) + "\n");
  }

  process.exit(0);
}

if (isCliInvocation()) main();
