#!/usr/bin/env node
// Validates all skill files in the skills/ registry against the frontmatter schema.
// Exit 0 = all valid. Exit 1 = validation errors found.
// Run: node scripts/validate-skills.js [--strict]

"use strict";

const { readdirSync, readFileSync, statSync } = require("fs");
const { join, relative, extname } = require("path");

const SKILLS_DIR = join(__dirname, "..", "skills");
const STRICT = process.argv.includes("--strict");

// ── Schema constants ──────────────────────────────────────────────────────────

const VALID_LAYERS = ["generic", "practice", "stack", "project", "compliance"];

const VALID_TASK_TYPES = new Set([
  // HTTP/Lambda
  "add-endpoint", "modify-endpoint",
  "add-handler", "modify-handler",
  "add-route",
  // Workers and queues
  "add-worker", "modify-worker",
  "add-queue-consumer", "debug-worker",
  // Database
  "add-migration", "modify-schema", "add-table", "add-column", "modify-table", "schema-migration",
  "add-query",
  // Frontend
  "add-component", "modify-component",
  "add-page", "add-form", "add-ui",
  "add-animation",
  "design-system",
  // AI / LLM
  "add-ai-call", "modify-llm-call",
  // Integrations
  "add-integration", "add-vendor",
  "add-dependency",
  // Features / flags
  "add-feature", "modify-feature",
  "add-feature-flag", "modify-feature-flag",
  // Events
  "add-event", "modify-event",
  // Admin / monitoring / ops
  "add-admin",
  "add-monitoring",
  "deploy", "refactor",
  "optimize-endpoint", "add-cache", "performance-audit",
  // Compliance / audit
  "audit", "compliance-check",
  // Process / review
  "design-review", "observability", "testing",
  // Project-specific (RABOS)
  "add-posting-rule", "modify-posting-rule", "add-coa-rule",
  "add-connector", "modify-connector",
  "add-geocoding", "modify-geocoding", "add-location",
  "add-insight", "modify-insight", "add-atlas-rule",
  "add-analyst", "modify-analyst",
  // Catch-all
  "any", "all",
]);

// ── Frontmatter parser ────────────────────────────────────────────────────────

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

// ── Validator ─────────────────────────────────────────────────────────────────

function validateSkill(filePath, content) {
  const errors = [];
  const warnings = [];

  const fm = parseFrontmatter(content);
  if (!fm) {
    // Legacy flat files have no frontmatter — skip validation, return special marker
    return { errors: [], warnings: [], legacy: true };
  }

  // Required fields
  for (const field of ["id", "title", "layer", "tags", "applies_to", "size_tokens"]) {
    if (fm[field] === undefined || fm[field] === null || fm[field] === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // id: kebab-case
  if (fm.id && typeof fm.id === "string" && fm.id.length > 1) {
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(fm.id)) {
      errors.push(`id must be kebab-case (lowercase, hyphens only): got "${fm.id}"`);
    }
  }

  // layer enum
  if (fm.layer && !VALID_LAYERS.includes(fm.layer)) {
    errors.push(`layer must be one of: ${VALID_LAYERS.join(", ")} — got "${fm.layer}"`);
  }

  // Layer-specific required fields
  if (fm.layer === "stack" && !fm.stack) {
    errors.push('layer=stack requires a "stack" field (e.g. stack: react-supabase-lambda)');
  }
  if (fm.layer === "project" && !fm.project) {
    errors.push('layer=project requires a "project" field (e.g. project: rabos)');
  }
  if (fm.layer === "compliance" && !fm.compliance_module) {
    errors.push('layer=compliance requires a "compliance_module" field (e.g. compliance_module: gdpr)');
  }

  // tags
  if (Array.isArray(fm.tags)) {
    if (fm.tags.length < 2)  warnings.push("tags: fewer than 2 tags — add more for discoverability");
    if (fm.tags.length > 10) warnings.push(`tags: ${fm.tags.length} tags is a lot — aim for 4–6`);
  } else if (fm.tags !== undefined) {
    errors.push("tags must be an inline array: tags: [tag1, tag2]");
  }

  // applies_to
  if (fm.applies_to && typeof fm.applies_to === "object") {
    const at = fm.applies_to;

    if (!at.task_types) {
      errors.push("applies_to.task_types is required");
    } else if (!Array.isArray(at.task_types)) {
      errors.push("applies_to.task_types must be an array");
    } else {
      const unknown = at.task_types.filter((t) => !VALID_TASK_TYPES.has(t));
      if (unknown.length > 0) {
        const msg = `applies_to.task_types unknown slugs: ${unknown.join(", ")}`;
        STRICT ? errors.push(msg) : warnings.push(msg + " (add to VALID_TASK_TYPES if intentional)");
      }
    }

    if (!at.stages) {
      errors.push("applies_to.stages is required");
    } else if (!Array.isArray(at.stages)) {
      errors.push("applies_to.stages must be an array");
    } else {
      // "all" is a valid sentinel meaning "every stage"
      const invalid = at.stages.filter((s) => s !== "all" && (typeof s !== "number" || s < 1 || s > 20));
      if (invalid.length > 0) {
        errors.push(`applies_to.stages invalid values: ${invalid.join(", ")} (use integers 1–20 or "all")`);
      }
    }
  }

  // size_tokens
  if (fm.size_tokens !== undefined) {
    if (typeof fm.size_tokens !== "number") {
      errors.push("size_tokens must be a number");
    } else if (fm.size_tokens < 50 || fm.size_tokens > 600) {
      warnings.push(`size_tokens=${fm.size_tokens} is outside expected 50–600 range`);
    }
  }

  // Pattern Summary section
  const body = content.replace(/^---[\s\S]*?---\r?\n/, "");
  if (!body.includes("## Pattern Summary")) {
    errors.push('Missing required "## Pattern Summary" section');
  }

  // related field type check
  if (fm.related !== undefined && !Array.isArray(fm.related)) {
    errors.push("related must be an array of skill IDs: related: [id1, id2]");
  }

  return { errors, warnings };
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

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const files = walkSkills(SKILLS_DIR);
  let totalErrors = 0;
  let totalWarnings = 0;
  let legacyCount = 0;
  const errorFiles = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const result = validateSkill(filePath, content);
    const rel = relative(SKILLS_DIR, filePath).replace(/\\/g, "/");

    if (result.legacy) {
      legacyCount++;
      continue;  // flat legacy files — skip silently
    }

    const { errors, warnings } = result;

    if (errors.length > 0) {
      errorFiles.push(rel);
      console.error(`\nFAIL  ${rel}`);
      for (const e of errors) console.error(`      ERROR: ${e}`);
      totalErrors += errors.length;
    }

    if (warnings.length > 0) {
      if (errors.length === 0) console.warn(`\nWARN  ${rel}`);
      for (const w of warnings) console.warn(`      WARN:  ${w}`);
      totalWarnings += warnings.length;
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Skills scanned : ${files.length}`);
  console.log(`  With schema  : ${files.length - legacyCount}`);
  console.log(`  Legacy (skip): ${legacyCount}`);
  console.log(`Errors         : ${totalErrors}`);
  console.log(`Warnings       : ${totalWarnings}`);

  if (totalErrors > 0) {
    console.error(`\nFailed (${errorFiles.length}):\n  ${errorFiles.join("\n  ")}`);
    console.error(`\nValidation FAILED — fix errors before merging.\n`);
    process.exit(1);
  }

  console.log(`\nValidation PASSED\n`);
}

main();
