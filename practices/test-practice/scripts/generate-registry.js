#!/usr/bin/env node
// Generates skills/registry.json — a machine-readable index of all skills.
// Fast tag/task-type lookups without parsing every file at query time.
//
// Run:         node scripts/generate-registry.js
// Drift check: node scripts/generate-registry.js --check  (exits 1 if stale)

"use strict";

const { readdirSync, readFileSync, writeFileSync, statSync, existsSync } = require("fs");
const { join, relative, extname } = require("path");

const SKILLS_DIR = join(__dirname, "..", "skills");
const REGISTRY_PATH = join(SKILLS_DIR, "registry.json");
const CHECK_MODE = process.argv.includes("--check");

// ── Frontmatter parser (mirrors validate-skills.js) ──────────────────────────

function parseValue(raw) {
  const s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((v) => {
      const t = v.trim();
      if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
      return isNaN(Number(t)) ? t : Number(t);
    });
  }
  if (s !== "" && !isNaN(Number(s))) return Number(s);
  if (s === "true") return true;
  if (s === "false") return false;
  return s;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const lines = match[1].split(/\r?\n/);
  const result = {};
  let nestedObj = null;

  for (const line of lines) {
    if ((line.startsWith("  ") || line.startsWith("\t")) && nestedObj !== null) {
      const m = line.match(/^\s+([\w][\w_-]*):\s*(.+)$/);
      if (m) nestedObj[m[1]] = parseValue(m[2]);
    } else {
      nestedObj = null;
      const m = line.match(/^([\w][\w_-]*):\s*(.*)$/);
      if (!m) continue;
      const [, key, val] = m;
      if (val.trim() === "") {
        nestedObj = {};
        result[key] = nestedObj;
      } else {
        result[key] = parseValue(val);
      }
    }
  }

  return result;
}

// ── Walk skills directory ─────────────────────────────────────────────────────

function walkSkills(dir, results) {
  results = results || [];
  for (const entry of readdirSync(dir)) {
    if (entry === "CONTRIBUTING.md" || entry === "registry.json") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSkills(full, results);
    } else if (extname(entry) === ".md") {
      results.push(full);
    }
  }
  return results;
}

// ── Build registry entry ──────────────────────────────────────────────────────

function buildEntry(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const fm = parseFrontmatter(content);
  if (!fm || !fm.id) return null;

  const entry = {
    id:          fm.id,
    title:       fm.title || "",
    layer:       fm.layer || "generic",
    file:        relative(SKILLS_DIR, filePath).replace(/\\/g, "/"),
    tags:        Array.isArray(fm.tags) ? fm.tags : [],
    applies_to: {
      task_types: (fm.applies_to && fm.applies_to.task_types) ? fm.applies_to.task_types : [],
      stages:     (fm.applies_to && fm.applies_to.stages) ? fm.applies_to.stages : [],
    },
    size_tokens: fm.size_tokens || 0,
    related:     Array.isArray(fm.related) ? fm.related : [],
  };

  if (fm.stack)             entry.stack = fm.stack;
  if (fm.project)           entry.project = fm.project;
  if (fm.compliance_module) entry.compliance_module = fm.compliance_module;

  return entry;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const files = walkSkills(SKILLS_DIR);
  const skills = [];
  let skipped = 0;

  for (const filePath of files) {
    const entry = buildEntry(filePath);
    if (entry) {
      skills.push(entry);
    } else {
      skipped++;
      process.stderr.write(`WARN: skipped (no valid frontmatter): ${relative(SKILLS_DIR, filePath)}\n`);
    }
  }

  skills.sort((a, b) => a.file.localeCompare(b.file));

  const registry = {
    schema:       "skill-registry/1.0",
    generated_at: new Date().toISOString(),
    count:        skills.length,
    skills,
  };

  const json = JSON.stringify(registry, null, 2) + "\n";

  if (CHECK_MODE) {
    if (!existsSync(REGISTRY_PATH)) {
      console.error("ERROR: registry.json missing. Run: npm run skills:index");
      process.exit(1);
    }

    const existing = JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
    const generated = JSON.parse(json);

    // Compare only the skills array (ignore generated_at timestamp)
    if (JSON.stringify(existing.skills) !== JSON.stringify(generated.skills)) {
      console.error("ERROR: registry.json is stale. Run: npm run skills:index and commit the result.");
      process.exit(1);
    }

    console.log(`registry.json is up to date (${skills.length} skills)`);
    return;
  }

  writeFileSync(REGISTRY_PATH, json, "utf-8");
  console.log(`Generated registry.json — ${skills.length} skills, ${skipped} skipped`);
}

main();
