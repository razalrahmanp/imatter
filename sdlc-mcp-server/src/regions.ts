import { createHash } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RegionType = "framework" | "user" | "user-override" | "placeholder";

export interface Region {
  id: string;
  type: RegionType;

  // Line positions (1-indexed, inclusive)
  startLine: number;
  endLine: number;
  contentStartLine: number;
  contentEndLine: number;
  content: string;
  rawOpenTag: string;

  // framework-only
  since?: string;
  hash?: string;
  overriddenBy?: string;
  locked?: boolean;

  // user-override-only
  overrides?: string;
  originalHash?: string;
  createdAt?: string;

  // placeholder-only
  prompt?: string;

  // Tree
  children: Region[];
  parentId?: string;

  // Derived — set by parser, never stored in the file
  dirty: boolean;         // framework: content hash ≠ recorded hash
  overrideStale: boolean; // user-override: originalHash ≠ current framework hash
}

export interface UntaggedBlock {
  startLine: number;
  endLine: number;
  content: string;
}

export type ParseErrorCode =
  | "UNCLOSED_TAG"
  | "FRAMEWORK_IN_USER"
  | "NESTED_FRAMEWORK"
  | "DUPLICATE_ID"
  | "END_WITHOUT_START"
  | "MISSING_REQUIRED_ATTR"
  | "INVALID_END_TAG";

export type ParseWarningCode =
  | "UNKNOWN_TYPE"
  | "UNRECOGNIZED_ATTR"
  | "MISSING_HASH"
  | "HASH_MISMATCH"
  | "OVERRIDE_STALE";

export interface ParseError {
  code: ParseErrorCode;
  line: number;
  message: string;
  id?: string;
}

export interface ParseWarning {
  code: ParseWarningCode;
  line: number;
  message: string;
  id?: string;
}

export interface ParseResult {
  regions: Region[];        // flat list, all regions
  tree: Region[];           // top-level only, children nested
  untagged: UntaggedBlock[];
  errors: ParseError[];
  warnings: ParseWarning[];
  isFullyTagged: boolean;
  frameworkVersion?: string;
}

// ── Internal parser state ──────────────────────────────────────────────────────

interface OpenFrame {
  id: string;
  type: RegionType;
  startLine: number;
  rawOpenTag: string;
  attrs: Record<string, string>;
  contentLines: string[];
  contentStartLine: number;
  parentId?: string;
}

// ── Tag patterns ───────────────────────────────────────────────────────────────

const START_RE =
  /<!--\s*SDLC:start\s+(.*?)\s*-->/;
const END_RE =
  /<!--\s*SDLC:end\s+(.*?)\s*-->/;
const PLACEHOLDER_RE =
  /<!--\s*SDLC:placeholder\s+(.*?)\s*-->/;
const VERSION_RE =
  /<!--\s*SDLC:version\s+"?([\d.]+)"?\s*-->/;

const KNOWN_FRAMEWORK_ATTRS = new Set([
  "type", "id", "since", "hash", "overridden-by", "locked",
]);
const KNOWN_USER_OVERRIDE_ATTRS = new Set([
  "type", "id", "overrides", "original-hash", "created",
]);
const KNOWN_USER_ATTRS = new Set(["type", "id"]);
const KNOWN_PLACEHOLDER_ATTRS = new Set(["id", "prompt"]);

// ── Attr parser ───────────────────────────────────────────────────────────────

function parseAttrs(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Matches: key="value" or key='value' or key=value
  const re = /(\w[\w-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    result[m[1]] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return result;
}

// ── Hash helpers ───────────────────────────────────────────────────────────────

export function hashContent(content: string): string {
  return createHash("sha256")
    .update(content.trim(), "utf-8")
    .digest("hex")
    .slice(0, 8);
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseRegions(docContent: string): ParseResult {
  const lines = docContent.replace(/\r\n/g, "\n").split("\n");
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const allRegions: Region[] = [];
  const seenIds = new Set<string>();

  // Stack of open frames; innermost is last
  const stack: OpenFrame[] = [];

  // Lines not inside any region
  const untaggedLines: { line: number; text: string }[] = [];
  let frameworkVersion: string | undefined;

  function currentFrame(): OpenFrame | undefined {
    return stack[stack.length - 1];
  }

  function warnUnknownAttrs(
    attrs: Record<string, string>,
    known: Set<string>,
    line: number,
    id: string,
  ) {
    for (const k of Object.keys(attrs)) {
      if (!known.has(k)) {
        warnings.push({
          code: "UNRECOGNIZED_ATTR",
          line,
          message: `Unrecognized attribute "${k}" on region "${id}"`,
          id,
        });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // ── Version marker ──────────────────────────────────────────────────────
    const verMatch = VERSION_RE.exec(line);
    if (verMatch) {
      frameworkVersion = verMatch[1];
      currentFrame()?.contentLines.push(line);
      continue;
    }

    // ── Placeholder ─────────────────────────────────────────────────────────
    const phMatch = PLACEHOLDER_RE.exec(line);
    if (phMatch) {
      const attrs = parseAttrs(phMatch[1]);
      const id = attrs["id"] ?? `placeholder-${lineNum}`;
      if (!attrs["id"]) {
        errors.push({
          code: "MISSING_REQUIRED_ATTR",
          line: lineNum,
          message: `SDLC:placeholder at line ${lineNum} missing required attribute "id"`,
        });
      }
      warnUnknownAttrs(attrs, KNOWN_PLACEHOLDER_ATTRS, lineNum, id);

      const region: Region = {
        id,
        type: "placeholder",
        startLine: lineNum,
        endLine: lineNum,
        contentStartLine: lineNum,
        contentEndLine: lineNum,
        content: "",
        rawOpenTag: line.trim(),
        prompt: attrs["prompt"],
        children: [],
        parentId: currentFrame()?.id,
        dirty: false,
        overrideStale: false,
      };
      allRegions.push(region);
      currentFrame()?.contentLines.push(line);
      continue;
    }

    // ── Start tag ───────────────────────────────────────────────────────────
    const startMatch = START_RE.exec(line);
    if (startMatch) {
      const attrs = parseAttrs(startMatch[1]);
      const rawType = attrs["type"] ?? "user";
      // For user-override blocks, `overrides` doubles as the implicit id when no id= is given.
      // Convention: id = `${overrides}-override` so the relationship is bidirectional and unique.
      const id = attrs["id"]
        ?? (rawType === "user-override" && attrs["overrides"]
          ? `${attrs["overrides"]}-override`
          : undefined);

      if (!id) {
        errors.push({
          code: "MISSING_REQUIRED_ATTR",
          line: lineNum,
          message: `SDLC:start at line ${lineNum} missing required attribute "id"`,
        });
        currentFrame()?.contentLines.push(line);
        continue;
      }

      if (!attrs["type"]) {
        errors.push({
          code: "MISSING_REQUIRED_ATTR",
          line: lineNum,
          message: `SDLC:start for "${id}" at line ${lineNum} missing required attribute "type"`,
          id,
        });
      }

      // Validate type
      let type: RegionType = "user";
      if (
        rawType === "framework" ||
        rawType === "user" ||
        rawType === "user-override"
      ) {
        type = rawType;
      } else {
        warnings.push({
          code: "UNKNOWN_TYPE",
          line: lineNum,
          message: `Unknown region type "${rawType}" for "${id}" — treating as "user"`,
          id,
        });
      }

      // Nesting rules
      const parent = currentFrame();
      if (parent) {
        if (type === "framework" && parent.type === "framework") {
          errors.push({
            code: "NESTED_FRAMEWORK",
            line: lineNum,
            message: `Framework region "${id}" cannot be nested inside framework region "${parent.id}"`,
            id,
          });
          parent.contentLines.push(line);
          continue;
        }
        if (type === "framework" && parent.type === "user") {
          errors.push({
            code: "FRAMEWORK_IN_USER",
            line: lineNum,
            message: `Framework region "${id}" cannot be nested inside user region "${parent.id}"`,
            id,
          });
          parent.contentLines.push(line);
          continue;
        }
      }

      // Duplicate IDs
      if (seenIds.has(id)) {
        errors.push({
          code: "DUPLICATE_ID",
          line: lineNum,
          message: `Duplicate region id "${id}" at line ${lineNum}`,
          id,
        });
      }
      seenIds.add(id);

      // Warn on unknown attrs
      if (type === "framework") warnUnknownAttrs(attrs, KNOWN_FRAMEWORK_ATTRS, lineNum, id);
      else if (type === "user-override") warnUnknownAttrs(attrs, KNOWN_USER_OVERRIDE_ATTRS, lineNum, id);
      else warnUnknownAttrs(attrs, KNOWN_USER_ATTRS, lineNum, id);

      // Required attrs per type
      if (type === "framework") {
        if (!attrs["since"])
          errors.push({ code: "MISSING_REQUIRED_ATTR", line: lineNum, message: `Framework region "${id}" missing required attribute "since"`, id });
        if (!attrs["hash"])
          warnings.push({ code: "MISSING_HASH", line: lineNum, message: `Framework region "${id}" has no "hash" attribute — dirty detection disabled`, id });
      }
      if (type === "user-override") {
        if (!attrs["overrides"])
          errors.push({ code: "MISSING_REQUIRED_ATTR", line: lineNum, message: `User-override region "${id}" missing required attribute "overrides"`, id });
        if (!attrs["original-hash"])
          errors.push({ code: "MISSING_REQUIRED_ATTR", line: lineNum, message: `User-override region "${id}" missing required attribute "original-hash"`, id });
        if (!attrs["created"])
          errors.push({ code: "MISSING_REQUIRED_ATTR", line: lineNum, message: `User-override region "${id}" missing required attribute "created"`, id });
      }

      stack.push({
        id,
        type,
        startLine: lineNum,
        rawOpenTag: line.trim(),
        attrs,
        contentLines: [],
        contentStartLine: lineNum + 1,
        parentId: parent?.id,
      });
      continue;
    }

    // ── End tag ─────────────────────────────────────────────────────────────
    const endMatch = END_RE.exec(line);
    if (endMatch) {
      const endAttrs = parseAttrs(endMatch[1]);
      // For user-override end tags, `overrides=X` matches a frame with id `X-override`.
      const rawEndId = endAttrs["id"] ?? endAttrs["overrides"];
      const overrideId = endAttrs["overrides"] ? `${endAttrs["overrides"]}-override` : undefined;
      // Prefer the explicit id; if not present, try both raw and override-derived
      const currentFrameId = currentFrame()?.id;
      const endId = endAttrs["id"]
        ?? (overrideId && overrideId === currentFrameId ? overrideId : rawEndId);

      if (!endId) {
        errors.push({
          code: "INVALID_END_TAG",
          line: lineNum,
          message: `SDLC:end at line ${lineNum} has no "id" or "overrides" attribute`,
        });
        currentFrame()?.contentLines.push(line);
        continue;
      }

      const frame = currentFrame();
      if (!frame) {
        errors.push({
          code: "END_WITHOUT_START",
          line: lineNum,
          message: `SDLC:end for "${endId}" at line ${lineNum} has no matching SDLC:start`,
          id: endId,
        });
        continue;
      }

      if (frame.id !== endId) {
        errors.push({
          code: "END_WITHOUT_START",
          line: lineNum,
          message: `SDLC:end for "${endId}" at line ${lineNum} does not match open region "${frame.id}"`,
          id: endId,
        });
        currentFrame()?.contentLines.push(line);
        continue;
      }

      stack.pop();

      const rawContent = frame.contentLines.join("\n");
      const contentHash = hashContent(rawContent);
      const recordedHash = frame.attrs["hash"];

      const dirty =
        frame.type === "framework" && !!recordedHash && contentHash !== recordedHash;

      if (dirty) {
        warnings.push({
          code: "HASH_MISMATCH",
          line: frame.startLine,
          message: `Framework region "${frame.id}" has been edited (recorded hash ${recordedHash}, actual ${contentHash})`,
          id: frame.id,
        });
      }

      const region: Region = {
        id: frame.id,
        type: frame.type,
        startLine: frame.startLine,
        endLine: lineNum,
        contentStartLine: frame.contentStartLine,
        contentEndLine: lineNum - 1,
        content: rawContent,
        rawOpenTag: frame.rawOpenTag,
        since: frame.attrs["since"],
        hash: recordedHash,
        overriddenBy: frame.attrs["overridden-by"],
        locked: frame.attrs["locked"] === "true",
        overrides: frame.attrs["overrides"],
        originalHash: frame.attrs["original-hash"],
        createdAt: frame.attrs["created"],
        children: [],
        parentId: frame.parentId,
        dirty,
        overrideStale: false, // resolved in post-pass below
      };

      allRegions.push(region);

      // Attach to parent or top level
      if (frame.parentId) {
        const parentRegion = allRegions.find((r) => r.id === frame.parentId);
        parentRegion?.children.push(region);
      }

      // Accumulate into parent frame's content lines if still open
      const newCurrent = currentFrame();
      if (newCurrent) {
        for (const cl of frame.contentLines) newCurrent.contentLines.push(cl);
        newCurrent.contentLines.push(line);
      }

      continue;
    }

    // ── Ordinary line ────────────────────────────────────────────────────────
    const frame = currentFrame();
    if (frame) {
      frame.contentLines.push(line);
    } else {
      untaggedLines.push({ line: lineNum, text: line });
    }
  }

  // ── Unclosed tags ─────────────────────────────────────────────────────────
  for (const frame of stack) {
    errors.push({
      code: "UNCLOSED_TAG",
      line: frame.startLine,
      message: `Region "${frame.id}" opened at line ${frame.startLine} was never closed`,
      id: frame.id,
    });
  }

  // ── Post-pass: resolve overrideStale ─────────────────────────────────────
  // Build a lookup of framework regions by ID
  const frameworkById = new Map<string, Region>();
  for (const r of allRegions) {
    if (r.type === "framework") frameworkById.set(r.id, r);
  }

  for (const r of allRegions) {
    if (r.type === "user-override" && r.overrides && r.originalHash) {
      const fw = frameworkById.get(r.overrides);
      if (fw?.hash && fw.hash !== r.originalHash) {
        r.overrideStale = true;
        warnings.push({
          code: "OVERRIDE_STALE",
          line: r.startLine,
          message:
            `Override "${r.id}" was created against framework hash ${r.originalHash}, ` +
            `but framework region "${r.overrides}" now has hash ${fw.hash}. Review required.`,
          id: r.id,
        });
      }
    }
  }

  // ── Build untagged blocks ─────────────────────────────────────────────────
  const untagged: UntaggedBlock[] = [];
  let blockStart: number | null = null;
  let blockLines: string[] = [];

  for (const { line: lineNum, text } of untaggedLines) {
    if (blockStart === null) {
      blockStart = lineNum;
      blockLines = [text];
    } else if (lineNum === (blockStart + blockLines.length)) {
      blockLines.push(text);
    } else {
      // Gap — flush previous block
      const trimmed = blockLines.join("\n").trim();
      if (trimmed) {
        untagged.push({
          startLine: blockStart,
          endLine: blockStart + blockLines.length - 1,
          content: trimmed,
        });
      }
      blockStart = lineNum;
      blockLines = [text];
    }
  }
  if (blockStart !== null) {
    const trimmed = blockLines.join("\n").trim();
    if (trimmed) {
      untagged.push({
        startLine: blockStart,
        endLine: blockStart + blockLines.length - 1,
        content: trimmed,
      });
    }
  }

  // ── Build top-level tree ──────────────────────────────────────────────────
  const tree = allRegions.filter((r) => !r.parentId);

  return {
    regions: allRegions,
    tree,
    untagged,
    errors,
    warnings,
    isFullyTagged: untagged.length === 0,
    frameworkVersion,
  };
}

// ── Serialiser ────────────────────────────────────────────────────────────────

/**
 * Rebuild a SDLC_VALIDATION.md from a ParseResult + original lines.
 * Framework regions whose content has changed get their hash recomputed.
 * User and user-override regions are emitted unchanged.
 */
export function serializeRegions(
  originalLines: string[],
  regions: Region[],
): string {
  // Build a map from startLine → Region for quick lookup
  const byStart = new Map<number, Region>();
  const byEnd = new Map<number, Region>();
  for (const r of regions) {
    if (r.type !== "placeholder") {
      byStart.set(r.startLine, r);
      byEnd.set(r.endLine, r);
    }
  }

  const out: string[] = [];
  const skip = new Set<number>(); // lines consumed by a region

  for (let i = 0; i < originalLines.length; i++) {
    const lineNum = i + 1;
    if (skip.has(lineNum)) continue;

    const region = byStart.get(lineNum);
    if (region) {
      // Emit fresh open tag with recomputed hash for framework regions
      if (region.type === "framework") {
        const newHash = hashContent(region.content);
        const newTag = region.rawOpenTag
          .replace(/hash="[^"]*"/, `hash="${newHash}"`)
          .replace(/hash='[^']*'/, `hash="${newHash}"`);
        out.push(newTag);
      } else {
        out.push(originalLines[i]);
      }

      // Skip all lines up to and including end tag
      for (let j = lineNum + 1; j <= region.endLine; j++) skip.add(j);

      // Emit content + end tag
      if (region.content) out.push(region.content);
      const endTag = region.type === "user-override"
        ? `<!-- SDLC:end overrides="${region.overrides}" -->`
        : `<!-- SDLC:end id="${region.id}" -->`;
      out.push(endTag);
      continue;
    }

    out.push(originalLines[i]);
  }

  return out.join("\n");
}
