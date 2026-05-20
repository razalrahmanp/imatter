#!/usr/bin/env node
// generate-template — developer tool, not shipped to end users
//
// Usage:
//   npx tsx src/generate-template.ts [--version=X.Y.Z] [--source=path] [--out=path]
//
// Reads the untagged template source, injects region markers, writes tagged
// output and a registry.json sidecar that upgrade --check uses for comparison.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateTaggedTemplate, serializeRegistry } from "./template-generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]): {
  version: string;
  sourcePath: string;
  outPath: string;
  registryPath: string;
} {
  const version =
    argv.find((a) => a.startsWith("--version="))?.split("=")[1] ?? "1.0.0";

  const defaultSource = resolve(__dirname, "../../plugin/template/SDLC_VALIDATION.source.md");
  const defaultOut = resolve(__dirname, "../../plugin/template/SDLC_VALIDATION.md");
  const defaultRegistry = resolve(__dirname, "../../plugin/template/registry.json");

  const sourcePath = argv.find((a) => a.startsWith("--source="))?.split("=")[1]
    ? resolve(argv.find((a) => a.startsWith("--source="))!.split("=")[1])
    : defaultSource;

  const outPath = argv.find((a) => a.startsWith("--out="))?.split("=")[1]
    ? resolve(argv.find((a) => a.startsWith("--out="))!.split("=")[1])
    : defaultOut;

  const registryPath = argv.find((a) => a.startsWith("--registry="))?.split("=")[1]
    ? resolve(argv.find((a) => a.startsWith("--registry="))!.split("=")[1])
    : defaultRegistry;

  return { version, sourcePath, outPath, registryPath };
}

function main(): void {
  const { version, sourcePath, outPath, registryPath } = parseArgs(process.argv.slice(2));

  if (!existsSync(sourcePath)) {
    // Fallback: if no .source.md exists, use the current tagged template as source.
    // This allows bootstrapping — the first run tags an untagged template.
    const fallback = outPath;
    if (!existsSync(fallback)) {
      process.stderr.write(`ERROR: Source file not found at ${sourcePath}\n`);
      process.exit(1);
    }
    process.stderr.write(
      `Note: No .source.md found — using ${fallback} as source (bootstrapping).\n` +
      `After this run, save ${fallback} without region markers as ${sourcePath} for future edits.\n`,
    );
  }

  const source = existsSync(sourcePath)
    ? readFileSync(sourcePath, "utf-8")
    : readFileSync(outPath, "utf-8");

  const { tagged, registry, unknownSections } = generateTaggedTemplate(source, version);

  if (unknownSections.length > 0) {
    process.stderr.write(
      `Warning: ${unknownSections.length} section(s) not in SECTION_MAP (emitted untagged):\n` +
      unknownSections.map((s) => `  - ${s}`).join("\n") + "\n",
    );
  }

  writeFileSync(outPath, tagged, "utf-8");
  writeFileSync(registryPath, serializeRegistry(registry, version), "utf-8");

  process.stdout.write(
    `Generated: ${outPath}\n` +
    `Registry:  ${registryPath}\n` +
    `Version:   ${version}\n` +
    `Regions:   ${registry.size}\n` +
    (unknownSections.length > 0
      ? `Unknown sections (untagged): ${unknownSections.length}\n`
      : ""),
  );
}

main();
