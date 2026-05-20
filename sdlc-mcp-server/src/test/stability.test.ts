// Plugin interface stability test suite.
//
// These tests verify that the public surface area of the plugin — the contracts
// custom skills, agents, compliance modules, and migration scripts rely on —
// hasn't silently changed. They are the trip-wire that catches breaking changes
// before a release ships.
//
// Run with: npm test (Node's built-in test runner — no Jest/Vitest needed).

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRegions, hashContent, serializeRegions } from "../regions.js";
import { generateTaggedTemplate, deserializeRegistry, SECTION_MAP } from "../template-generator.js";
import { detectEdits, applyResolutions } from "../resolve-edits.js";
import { parseChangelog } from "../whats-new.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");

// ── Region marker parser stability ────────────────────────────────────────────

test("regions: parseRegions returns the documented shape", () => {
  const input = `# Doc
<!-- SDLC:version "1.4.0" -->
<!-- SDLC:start type="framework" id="test-section" since="1.0.0" hash="abc12345" -->
Hello world
<!-- SDLC:end id="test-section" -->`;

  const result = parseRegions(input);

  assert.equal(typeof result.isFullyTagged, "boolean");
  assert.ok(Array.isArray(result.regions), "regions must be an array");
  assert.ok(Array.isArray(result.tree), "tree must be an array");
  assert.ok(Array.isArray(result.untagged), "untagged must be an array");
  assert.ok(Array.isArray(result.errors), "errors must be an array");
  assert.ok(Array.isArray(result.warnings), "warnings must be an array");
  assert.equal(result.frameworkVersion, "1.4.0", "version marker must be detected");
  assert.equal(result.regions.length, 1, "should find one region");

  const region = result.regions[0];
  assert.equal(region.id, "test-section");
  assert.equal(region.type, "framework");
  assert.equal(region.since, "1.0.0");
  assert.equal(region.hash, "abc12345");
  assert.equal(region.content, "Hello world");
});

test("regions: parser detects nested-framework as an error", () => {
  const input = `
<!-- SDLC:start type="framework" id="outer" since="1.0.0" hash="x" -->
<!-- SDLC:start type="framework" id="inner" since="1.0.0" hash="y" -->
nested
<!-- SDLC:end id="inner" -->
<!-- SDLC:end id="outer" -->`;
  const result = parseRegions(input);
  assert.ok(
    result.errors.some((e) => e.code === "NESTED_FRAMEWORK"),
    "must surface NESTED_FRAMEWORK error",
  );
});

test("regions: hash mismatch surfaces as a warning, not silent pass", () => {
  // The hash 'wronghash' doesn't match the actual content
  const input = `<!-- SDLC:start type="framework" id="x" since="1.0.0" hash="wronghash" -->
edited content
<!-- SDLC:end id="x" -->`;
  const result = parseRegions(input);
  const dirtyRegion = result.regions.find((r) => r.id === "x");
  assert.ok(dirtyRegion?.dirty, "region must be marked dirty");
  assert.ok(
    result.warnings.some((w) => w.code === "HASH_MISMATCH"),
    "must emit HASH_MISMATCH warning",
  );
});

test("regions: user-override staleness detected when framework hash changes", () => {
  const input = `<!-- SDLC:start type="framework" id="g" since="1.0.0" hash="newhash" -->
new content
<!-- SDLC:end id="g" -->
<!-- SDLC:start type="user-override" overrides="g" original-hash="oldhash" created="2026-05-01" -->
my edit
<!-- SDLC:end overrides="g" -->`;
  const result = parseRegions(input);
  const override = result.regions.find((r) => r.type === "user-override");
  assert.ok(override?.overrideStale, "override should be marked stale");
});

// ── Hash stability ────────────────────────────────────────────────────────────

test("hashContent: deterministic across calls", () => {
  const a = hashContent("hello world");
  const b = hashContent("hello world");
  assert.equal(a, b, "same input must produce same hash");
  assert.equal(a.length, 8, "hash is 8 hex chars");
});

test("hashContent: ignores leading/trailing whitespace", () => {
  assert.equal(hashContent("abc"), hashContent("  abc  "));
  assert.equal(hashContent("abc\n"), hashContent("abc"));
});

// ── Serialiser round-trip ─────────────────────────────────────────────────────

test("serializeRegions: round-trips an untouched document", () => {
  const input = `<!-- SDLC:start type="framework" id="r" since="1.0.0" hash="dummy" -->
content
<!-- SDLC:end id="r" -->`;
  const parsed = parseRegions(input);
  const out = serializeRegions(input.split("\n"), parsed.regions);
  const reparsed = parseRegions(out);
  assert.equal(reparsed.regions.length, 1);
  assert.equal(reparsed.regions[0].content, "content");
});

// ── Template generator stability ──────────────────────────────────────────────

test("template-generator: SECTION_MAP must include all base sections", () => {
  // Stability guarantee: these section IDs are part of the public contract.
  // Renaming any of them is a breaking change requiring a migration script.
  const required = [
    "0. Protocol Rules — Claude must read this first",
    "1. Project Identity",
    "2. Stage 1 — Inception & Requirements",
    "14. Working with Claude — Token & Context Discipline",
    "15. Decision Log",
    "18. Session Log",
    "Quick Reference — Gate Status Summary",
  ];
  for (const heading of required) {
    assert.ok(
      heading in SECTION_MAP,
      `SECTION_MAP missing required heading: "${heading}". ` +
      `Removing or renaming a heading is a breaking change.`,
    );
  }
});

test("template-generator: deterministic output for the same input", () => {
  const input = `# Doc

## 0. Protocol Rules — Claude must read this first

Rules here.

---

## 1. Project Identity

Identity here.
`;
  const a = generateTaggedTemplate(input, "1.4.0");
  const b = generateTaggedTemplate(input, "1.4.0");
  assert.equal(a.tagged, b.tagged, "same input must produce same output");
  // Both generations should have the same hashes
  for (const [id, va] of a.registry) {
    const vb = b.registry.get(id);
    assert.equal(va.hash, vb?.hash, `region "${id}" hash drifted between generations`);
  }
});

// ── Registry serialiser stability ─────────────────────────────────────────────

test("registry: JSON shape includes version, generated_at, regions", () => {
  const fixture = JSON.stringify({
    version: "1.4.0",
    generated_at: "2026-05-20T00:00:00Z",
    regions: [{ id: "x", hash: "h", since: "1.0.0", content: "c" }],
  });
  const { version, registry } = deserializeRegistry(fixture);
  assert.equal(version, "1.4.0");
  assert.equal(registry.size, 1);
  assert.equal(registry.get("x")?.hash, "h");
});

// ── Unauthorised-edit resolution ──────────────────────────────────────────────

test("resolve-edits: applyResolutions with 'discard' restores canonical content", () => {
  const input = `<!-- SDLC:start type="framework" id="rr" since="1.0.0" hash="wronghash" -->
user edit
<!-- SDLC:end id="rr" -->`;
  const registry = new Map([
    ["rr", { content: "canonical content", hash: hashContent("canonical content"), since: "1.0.0" }],
  ]);
  const { newContent, applied } = applyResolutions(
    input,
    [{ regionId: "rr", action: "discard" }],
    registry,
  );
  assert.equal(applied.length, 1);
  assert.match(newContent, /canonical content/);
  assert.doesNotMatch(newContent, /user edit/);
});

test("resolve-edits: applyResolutions with 'override' preserves user edit as override block", () => {
  const input = `<!-- SDLC:start type="framework" id="rs" since="1.0.0" hash="wronghash" -->
user edit
<!-- SDLC:end id="rs" -->`;
  const registry = new Map([
    ["rs", { content: "canonical content", hash: hashContent("canonical content"), since: "1.0.0" }],
  ]);
  const { newContent, applied } = applyResolutions(
    input,
    [{ regionId: "rs", action: "override" }],
    registry,
  );
  assert.equal(applied.length, 1);
  assert.match(newContent, /type="user-override"/, "should inject user-override block");
  assert.match(newContent, /user edit/, "user's edit must be preserved");
  assert.match(newContent, /canonical content/, "framework content must be restored");
});

test("resolve-edits: detectEdits finds only dirty framework regions", () => {
  const input = `<!-- SDLC:start type="framework" id="clean" since="1.0.0" hash="${hashContent("hello")}" -->
hello
<!-- SDLC:end id="clean" -->
<!-- SDLC:start type="framework" id="dirty" since="1.0.0" hash="oldhash" -->
changed
<!-- SDLC:end id="dirty" -->`;
  const edits = detectEdits(input);
  assert.equal(edits.length, 1);
  assert.equal(edits[0].regionId, "dirty");
});

// ── Changelog parser stability ────────────────────────────────────────────────

test("changelog parser: extracts version, date, headline", () => {
  const md = `# Changelog

## [1.4.0] — 2026-05-20 — Region marker foundation

Body text here.

## [1.3.0] — 2026-05-19 — Multi-agent dispatch

More body.
`;
  const entries = parseChangelog(md);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].version, "1.4.0");
  assert.equal(entries[0].date, "2026-05-20");
  assert.equal(entries[0].headline, "Region marker foundation");
  assert.match(entries[0].body, /Body text here/);
});

// ── Plugin artefact stability ─────────────────────────────────────────────────

test("plugin: marketplace.json must declare hooks, mcpServers, skills, agents", () => {
  const manifestPath = join(REPO_ROOT, ".claude-plugin", "marketplace.json");
  if (!existsSync(manifestPath)) {
    return; // Allow running outside the source repo
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  const plugin = manifest.plugins?.[0];
  assert.ok(plugin, "marketplace.json must have at least one plugin");
  assert.ok(plugin.hooks, "plugin must declare hooks");
  assert.ok(plugin.mcpServers, "plugin must declare mcpServers");
  assert.ok(plugin.skills, "plugin must declare skills");
  assert.ok(plugin.agents, "plugin must declare agents (added in v1.4)");
});

test("plugin: every shipped agent has valid frontmatter", () => {
  const agentsDir = join(REPO_ROOT, "plugin", "agents");
  if (!existsSync(agentsDir)) return;
  const files = readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 0, "must ship at least one agent");

  for (const f of files) {
    const content = readFileSync(join(agentsDir, f), "utf-8");
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(fmMatch, `agent ${f} missing frontmatter`);
    const fm = fmMatch[1];
    assert.match(fm, /^name:\s*\S+/m, `agent ${f} missing name field`);
    assert.match(fm, /^description:\s*\S/m, `agent ${f} missing description field`);
  }
});

test("plugin: at least one migration script exists and exports `migration`", async () => {
  const migrationsDir = join(REPO_ROOT, "sdlc-mcp-server", "src", "migrations");
  if (!existsSync(migrationsDir)) return;
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
  assert.ok(files.length > 0, "must have at least one migration script");

  // Static check: each file must export `migration`
  for (const f of files) {
    const content = readFileSync(join(migrationsDir, f), "utf-8");
    assert.match(
      content,
      /export\s+const\s+migration\s*[:=]/,
      `migration ${f} must export a const named "migration"`,
    );
  }
});
