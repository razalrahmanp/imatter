#!/usr/bin/env node
// sdlc-tag — apply SDLC region markers to an existing SDLC_VALIDATION.md
//
// Usage:
//   sdlc-tag [--project-root=<path>] [--dry-run] [--force]

import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolveProjectRoot, findSdlcFile } from "./sdlc.js";
import { parseRegions, hashContent } from "./regions.js";
import { SECTION_MAP } from "./template-generator.js";
import { FRAMEWORK_VERSION } from "./state.js";

function parseArgs(argv: string[]): {
  projectRoot?: string;
  dryRun: boolean;
  force: boolean;
} {
  return {
    projectRoot: argv.find((x) => x.startsWith("--project-root="))?.split("=")[1],
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
  };
}

function sectionEnd(lines: string[], headingIndex: number): number {
  const level = (lines[headingIndex].match(/^#+/) ?? ["##"])[0].length;
  const pattern = new RegExp(`^#{1,${level}}\\s`);
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i;
  }
  return lines.length;
}

async function main(): Promise<void> {
  const { projectRoot, dryRun, force } = parseArgs(process.argv.slice(2));
  const root = resolveProjectRoot(projectRoot);
  const sdlcPath = findSdlcFile(root);

  const raw = readFileSync(sdlcPath, "utf-8");
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  const parsed = parseRegions(raw);
  if (parsed.regions.length > 0 && !force) {
    process.stdout.write(
      `${sdlcPath} already has ${parsed.regions.length} region(s). Use --force to re-tag.\n`
    );
    process.exit(0);
  }

  // Strip existing SDLC marker comments so --force produces a clean re-tag
  const sdlcMarker = /^<!--\s*SDLC:/;
  const sourceLines = force
    ? lines.filter((l) => !sdlcMarker.test(l.trim()))
    : lines;

  const out: string[] = [];
  if (!sourceLines.some((l) => l.includes("SDLC:version"))) {
    out.push(`<!-- SDLC:version "${FRAMEWORK_VERSION}" -->`);
  }

  let i = 0;
  let matchedCount = 0;
  while (i < sourceLines.length) {
    const line = sourceLines[i];
    const headingMatch = line.match(/^##\s+(.+)$/);
    const sectionKey = headingMatch ? headingMatch[1].trim() : null;
    const sectionDef = sectionKey ? SECTION_MAP[sectionKey] : undefined;

    if (sectionDef) {
      const end = sectionEnd(sourceLines, i);
      const sectionLines = sourceLines.slice(i, end);
      matchedCount++;
      const content = sectionLines.join("\n");
      const hash = hashContent(content);

      out.push(`<!-- SDLC:start type="framework" id="${sectionDef.id}" since="${sectionDef.since}" hash="${hash}" -->`);
      for (const sl of sectionLines) out.push(sl);
      out.push(`<!-- SDLC:end id="${sectionDef.id}" -->`);

      if ((sectionDef.pattern === "stage" || sectionDef.pattern === "log") && sectionDef.customId) {
        out.push(`<!-- SDLC:start type="user" id="${sectionDef.customId}" -->`);
        out.push(`<!-- SDLC:end id="${sectionDef.customId}" -->`);
      }

      i = end;
      continue;
    }

    out.push(line);
    i++;
  }

  const result = out.join("\n");

  if (dryRun) {
    process.stdout.write(`[dry-run] Would write ${result.split("\n").length} lines to ${sdlcPath}\n`);
    process.stdout.write(`Sections to tag: ${matchedCount}\n`);
    process.exit(0);
  }

  copyFileSync(sdlcPath, sdlcPath + ".bak");
  writeFileSync(sdlcPath, result, "utf-8");
  process.stdout.write(`Tagged: ${sdlcPath}\n`);
  process.stdout.write(`Sections tagged: ${matchedCount}\n`);
  process.stdout.write(`Backup: ${sdlcPath}.bak\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(2);
});
