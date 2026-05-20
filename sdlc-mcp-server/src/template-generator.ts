import { hashContent } from "./regions.js";

// ── Region map ─────────────────────────────────────────────────────────────────
//
// Defines how every top-level section in SDLC_VALIDATION.md is wrapped.
//
// Three patterns:
//   "framework"   — the whole section is framework-owned. Migration replaces it.
//   "stage"       — framework section + empty user sibling for custom criteria.
//   "log"         — framework header (heading + table schema) + user rows sibling.

type SectionPattern = "framework" | "stage" | "log";

interface SectionDef {
  id: string;             // stable kebab-case ID
  pattern: SectionPattern;
  since: string;          // version the region was introduced
  customId?: string;      // id for the user sibling (stage/log patterns)
}

// Keyed by the exact text after "## ", trimmed.
const SECTION_MAP: Record<string, SectionDef> = {
  "0. Protocol Rules — Claude must read this first": {
    id: "protocol-rules",
    pattern: "framework",
    since: "1.0.0",
  },
  "1. Project Identity": {
    id: "project-identity",
    pattern: "framework",
    since: "1.0.0",
  },
  "2. Stage 1 — Inception & Requirements": {
    id: "stage-1-inception",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-1-custom",
  },
  "3. Stage 2 — Architecture & Design": {
    id: "stage-2-architecture",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-2-custom",
  },
  "4. Stage 3 — Development Practices & Standards": {
    id: "stage-3-dev-practices",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-3-custom",
  },
  "5. Stage 4 — Testing Strategy": {
    id: "stage-4-testing",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-4-custom",
  },
  "6. Stage 5 — Build & Continuous Integration": {
    id: "stage-5-ci",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-5-custom",
  },
  "7. Stage 6 — Deployment & Release": {
    id: "stage-6-deployment",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-6-custom",
  },
  "8. Stage 7 — Observability & Operations": {
    id: "stage-7-observability",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-7-custom",
  },
  "9. Stage 8 — Security": {
    id: "stage-8-security",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-8-custom",
  },
  "10. Stage 9 — Performance & Scale": {
    id: "stage-9-performance",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-9-custom",
  },
  "11. Stage 10 — Data & Analytics Engineering": {
    id: "stage-10-data",
    pattern: "stage",
    since: "1.0.0",
    customId: "stage-10-custom",
  },
  "12. Cross-cutting — Compute Placement": {
    id: "cross-cutting-compute",
    pattern: "stage",
    since: "1.0.0",
    customId: "cross-cutting-compute-custom",
  },
  "13. Cross-cutting — Cost Engineering": {
    id: "cross-cutting-cost",
    pattern: "stage",
    since: "1.0.0",
    customId: "cross-cutting-cost-custom",
  },
  "14. Working with Claude — Token & Context Discipline": {
    id: "context-management",
    pattern: "framework",
    since: "1.0.0",
  },
  "15. Decision Log": {
    id: "decision-log-header",
    pattern: "log",
    since: "1.0.0",
    customId: "decision-log-rows",
  },
  "16. Open Items": {
    id: "open-items-header",
    pattern: "log",
    since: "1.0.0",
    customId: "open-items-rows",
  },
  "17. Known Gaps & Deferred Items": {
    id: "known-gaps-header",
    pattern: "log",
    since: "1.0.0",
    customId: "known-gaps-rows",
  },
  "18. Session Log": {
    id: "session-log-header",
    pattern: "log",
    since: "1.0.0",
    customId: "session-log-rows",
  },
  "Quick Reference — Gate Status Summary": {
    id: "quick-reference",
    pattern: "framework",
    since: "1.0.0",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function openTag(
  type: "framework" | "user",
  id: string,
  attrs: Record<string, string> = {},
): string {
  const extra = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join("");
  return `<!-- SDLC:start type="${type}" id="${id}"${extra} -->`;
}

function closeTag(id: string): string {
  return `<!-- SDLC:end id="${id}" -->`;
}

// Find the table separator row ("| --- | --- |") in a block of lines.
// Returns the index of the separator line, or -1 if not found.
function findTableSeparator(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (/^\|[-| :]+\|/.test(lines[i].trim())) return i;
  }
  return -1;
}

// ── Section splitter ──────────────────────────────────────────────────────────

interface Section {
  heading: string;   // text after "## ", trimmed
  lines: string[];   // all lines including the "## heading" line, without trailing "---" separator
}

function splitIntoSections(content: string): { preamble: string[]; sections: Section[] } {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: Section[] = [];
  let preamble: string[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = /^## (.+)$/.exec(line);
    if (headingMatch) {
      if (currentHeading !== null) {
        // Flush previous section, stripping trailing "---" separator
        const trimmed = stripTrailingSeparator(currentLines);
        sections.push({ heading: currentHeading, lines: trimmed });
      } else {
        preamble = stripTrailingSeparator(currentLines);
      }
      currentHeading = headingMatch[1].trim();
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  // Flush last section
  if (currentHeading !== null) {
    sections.push({ heading: currentHeading, lines: stripTrailingSeparator(currentLines) });
  } else {
    preamble = stripTrailingSeparator(currentLines);
  }

  return { preamble, sections };
}

function stripTrailingSeparator(lines: string[]): string[] {
  // Remove trailing blank lines and a trailing "---" divider
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  if (end > 0 && lines[end - 1].trim() === "---") end--;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  return lines.slice(0, end);
}

// ── Canonical-content registry ────────────────────────────────────────────────
//
// Maps region ID → canonical content string (trimmed).
// Built during generation — used by upgrade --check to compare against client files.

export type CanonicalRegistry = Map<string, { content: string; hash: string; since: string }>;

// ── Main generator ────────────────────────────────────────────────────────────

export interface GenerateResult {
  tagged: string;                 // the fully tagged template content
  registry: CanonicalRegistry;    // region ID → canonical content + hash
  unknownSections: string[];      // headings not found in SECTION_MAP (warning)
}

export function generateTaggedTemplate(
  sourceContent: string,
  version: string,
): GenerateResult {
  const { preamble, sections } = splitIntoSections(sourceContent);
  const registry: CanonicalRegistry = new Map();
  const unknownSections: string[] = [];
  const outParts: string[] = [];

  // Document header lines (before first ##)
  if (preamble.length > 0) {
    outParts.push(preamble.join("\n"));
  }

  // Version marker — always the first line
  const versionMarker = `<!-- SDLC:version "${version}" -->`;
  // Insert after first line of preamble (the # title line)
  const preambleStr = outParts[0] ?? "";
  const firstNewline = preambleStr.indexOf("\n");
  if (firstNewline !== -1) {
    outParts[0] =
      preambleStr.slice(0, firstNewline + 1) +
      versionMarker + "\n" +
      preambleStr.slice(firstNewline + 1);
  } else {
    outParts.push(versionMarker);
  }

  for (const section of sections) {
    const def = SECTION_MAP[section.heading];

    if (!def) {
      unknownSections.push(section.heading);
      // Emit as-is with no region markers (unknown sections are untagged)
      outParts.push(section.lines.join("\n") + "\n\n---");
      continue;
    }

    const sectionText = section.lines.join("\n");

    if (def.pattern === "framework") {
      const hash = hashContent(sectionText);
      const tag = openTag("framework", def.id, { since: def.since, hash });
      registry.set(def.id, { content: sectionText.trim(), hash, since: def.since });
      outParts.push(tag + "\n" + sectionText + "\n" + closeTag(def.id) + "\n\n---");
    }

    else if (def.pattern === "stage") {
      // Entire section content is framework-owned
      const hash = hashContent(sectionText);
      const tag = openTag("framework", def.id, { since: def.since, hash });
      registry.set(def.id, { content: sectionText.trim(), hash, since: def.since });

      // Append an empty user sibling for custom criteria
      const customId = def.customId!;
      const userTag = openTag("user", customId);
      const userContent = `\n<!-- Add your project-specific gate criteria here, one per line starting with - [ ] -->\n`;

      outParts.push(
        tag + "\n" +
        sectionText + "\n" +
        closeTag(def.id) + "\n\n" +
        userTag + "\n" +
        userContent +
        closeTag(customId) + "\n\n---",
      );
    }

    else if (def.pattern === "log") {
      // Split into framework header (heading + table schema) and user rows
      const logLines = section.lines;
      const sepIdx = findTableSeparator(logLines);

      let headerLines: string[];
      let rowLines: string[];

      if (sepIdx === -1) {
        // No table found — treat whole section as framework
        headerLines = logLines;
        rowLines = [];
      } else {
        // Framework owns: heading through table separator (inclusive)
        headerLines = logLines.slice(0, sepIdx + 1);
        // User owns: everything after separator
        rowLines = logLines.slice(sepIdx + 1);
      }

      const headerText = headerLines.join("\n");
      const headerHash = hashContent(headerText);
      const headerTag = openTag("framework", def.id, { since: def.since, hash: headerHash });
      registry.set(def.id, { content: headerText.trim(), hash: headerHash, since: def.since });

      const customId = def.customId!;
      const userTag = openTag("user", customId);
      const rowText = rowLines.length > 0 ? rowLines.join("\n") : "\n| | | | |\n";

      outParts.push(
        headerTag + "\n" +
        headerText + "\n" +
        closeTag(def.id) + "\n" +
        userTag + "\n" +
        rowText + "\n" +
        closeTag(customId) + "\n\n---",
      );
    }
  }

  return {
    tagged: outParts.join("\n\n"),
    registry,
    unknownSections,
  };
}

// ── Registry serialiser (for saving to disk) ──────────────────────────────────
//
// Saves the canonical registry as JSON so upgrade --check can load it without
// re-running the generator. Stored in plugin/template/registry.json.

export interface RegistryEntry {
  id: string;
  hash: string;
  since: string;
  content: string;
}

export function serializeRegistry(registry: CanonicalRegistry, version: string): string {
  const entries: RegistryEntry[] = [];
  for (const [id, val] of registry) {
    entries.push({ id, ...val });
  }
  return JSON.stringify({ version, generated_at: new Date().toISOString(), regions: entries }, null, 2);
}

export function deserializeRegistry(json: string): { version: string; registry: CanonicalRegistry } {
  const parsed = JSON.parse(json) as { version: string; regions: RegistryEntry[] };
  const registry: CanonicalRegistry = new Map();
  for (const entry of parsed.regions) {
    registry.set(entry.id, { content: entry.content, hash: entry.hash, since: entry.since });
  }
  return { version: parsed.version, registry };
}
