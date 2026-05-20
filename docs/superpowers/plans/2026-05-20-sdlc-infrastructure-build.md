# SDLC Validate Infrastructure Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 4 missing infrastructure pieces so all 10 SDLC audit stages can run with parallel agent dispatch, framework upgrades are safe, and the root project is fully configured.

**Architecture:** New MCP dispatch tools track parallel sub-agent execution state in `.sdlc-dispatch/`. A new `sdlc tag` CLI wraps SDLC_VALIDATION.md sections with region markers using the existing `regions.ts` parser. A new `sdlc migrate` CLI chains version migration scripts with backup/rollback. Stage configs for stages 1–3 and 6–10 are added directly to `.sdlc-state.json`.

**Tech Stack:** TypeScript, Node.js, existing `regions.ts` + `template-generator.ts` + `state.ts` + `integrity.ts`, MCP SDK (zod for schemas).

---

## What is already built — do not re-implement

| Component | Location | Status |
|---|---|---|
| All 20 MCP tools | `sdlc-mcp-server/src/server.ts` | ✓ Built |
| HMAC integrity | `sdlc-mcp-server/src/integrity.ts` | ✓ Built |
| Region parser/serializer | `sdlc-mcp-server/src/regions.ts` | ✓ Built |
| Template section map | `sdlc-mcp-server/src/template-generator.ts` | ✓ Built |
| `sdlc_task_checkpoint` MCP tool | `server.ts:1416` | ✓ Built |
| `sdlc_error_diagnose` MCP tool | `server.ts:1517` | ✓ Built |
| Plugin skills (6) | `plugin/skills/sdlc-*.md` | ✓ Built |
| `sdlc-audit` CLI | `sdlc-mcp-server/src/cli.ts` | ✓ Built |

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `sdlc-mcp-server/src/dispatch.ts` | Create | Dispatch types + `.sdlc-dispatch/` I/O |
| `sdlc-mcp-server/src/server.ts` | Modify | Add `sdlc_dispatch_agents` + `sdlc_dispatch_status` tools |
| `sdlc-mcp-server/src/tag.ts` | Create | `sdlc tag` CLI entry point |
| `sdlc-mcp-server/src/migrate.ts` | Create | `sdlc migrate` CLI entry point |
| `sdlc-mcp-server/migrations/1.0.0-to-1.1.0.ts` | Create | First migration script |
| `sdlc-mcp-server/tsconfig.json` | Verify | Ensure new entry points are included |
| `sdlc-mcp-server/package.json` | Modify | Add `sdlc-tag` and `sdlc-migrate` bin entries |
| `.sdlc-state.json` | Modify | Add stage configs for stages 1–3, 6–10 |
| `SDLC_VALIDATION.md` | Modify | Apply region markers via `sdlc tag` |

---

## Task 1: `dispatch.ts` — Dispatch types and I/O

**Files:**
- Create: `sdlc-mcp-server/src/dispatch.ts`

- [ ] **Step 1: Write the file**

```typescript
// sdlc-mcp-server/src/dispatch.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface DispatchAgent {
  ns: string;
  id: string;
  check: string;
  model: "haiku" | "sonnet" | "opus";
  status: "pending" | "reported" | "failed";
  reported_at?: string;
}

export interface DispatchRecord {
  dispatch_id: string;
  stage: number;
  created_at: string;
  completed_at?: string;
  agents: DispatchAgent[];
}

export function dispatchDir(projectRoot: string): string {
  const dir = join(projectRoot, ".sdlc-dispatch");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function dispatchPath(projectRoot: string, stage: number): string {
  return join(dispatchDir(projectRoot), `stage-${stage}.json`);
}

export function readDispatch(projectRoot: string, stage: number): DispatchRecord | null {
  const p = dispatchPath(projectRoot, stage);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as DispatchRecord;
}

export function writeDispatch(projectRoot: string, record: DispatchRecord): void {
  const p = dispatchPath(projectRoot, stage_from(record));
  writeFileSync(p, JSON.stringify(record, null, 2), "utf-8");
}

function stage_from(record: DispatchRecord): number {
  return record.stage;
}

export function makeDispatchId(stage: number): string {
  return `d-${new Date().toISOString().slice(0, 10)}-stage${stage}`;
}
```

- [ ] **Step 2: Build and verify no errors**

```
cd sdlc-mcp-server && npm run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Commit**

```
git add sdlc-mcp-server/src/dispatch.ts
git commit -m "feat: add dispatch.ts — dispatch record types and I/O for parallel agent tracking"
```

---

## Task 2: `sdlc_dispatch_agents` + `sdlc_dispatch_status` MCP tools

**Files:**
- Modify: `sdlc-mcp-server/src/server.ts` — add two tools after `sdlc_error_diagnose`

- [ ] **Step 1: Add imports to server.ts**

At the top of `server.ts`, after the existing imports, add:

```typescript
import {
  DispatchRecord,
  DispatchAgent,
  dispatchPath,
  readDispatch,
  writeDispatch,
  makeDispatchId,
  dispatchDir,
} from "./dispatch.js";
```

- [ ] **Step 2: Add `sdlc_dispatch_agents` tool**

After the closing of the `sdlc_error_diagnose` tool (after line ~1580), add:

```typescript
  server.tool(
    "sdlc_dispatch_agents",
    "Create a dispatch record for the current stage's sub-agents. " +
      "Returns a checklist of agents to run in parallel via the Agent tool. " +
      "Each agent should call sdlc_agent_write when done. " +
      "Call sdlc_dispatch_status to check progress, sdlc_gate_run when all have reported.",
    {
      stage: z.number().int().optional().describe("Stage number. Defaults to cursor.stage."),
      agent_ids: z
        .array(z.string())
        .optional()
        .describe("Subset of sub_agent IDs to dispatch. Omit to dispatch all agents in stage config."),
      project_root: z.string().optional(),
    },
    async ({ stage, agent_ids, project_root }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const state = readState(root);
        const targetStage = stage ?? state.cursor.stage;
        const stageKey = String(targetStage);
        const stageConfig = state.stages[stageKey];

        if (!stageConfig) {
          return {
            content: [{ type: "text", text: `No stage config for Stage ${targetStage}. Add stages.${stageKey} to .sdlc-state.json first.` }],
            isError: true,
          };
        }

        const agents: DispatchAgent[] = stageConfig.sub_agents
          .filter((a) => !agent_ids || agent_ids.includes(a.id))
          .map((a) => ({
            ns: a.ns,
            id: a.id,
            check: a.check,
            model: a.model,
            status: "pending" as const,
          }));

        if (agents.length === 0) {
          return {
            content: [{ type: "text", text: "No matching agents found in stage config." }],
            isError: true,
          };
        }

        const record: DispatchRecord = {
          dispatch_id: makeDispatchId(targetStage),
          stage: targetStage,
          created_at: new Date().toISOString(),
          agents,
        };

        writeDispatch(root, record);

        const checklist = agents
          .map((a) => `- [ ] **${a.id}** (${a.model}) ns="${a.ns}"\n  Check: ${a.check}`)
          .join("\n");

        return {
          content: [{
            type: "text",
            text:
              `Dispatch created: ${record.dispatch_id}\n` +
              `Stage ${targetStage} — ${stageConfig.name}\n` +
              `${agents.length} agent(s) to run:\n\n${checklist}\n\n` +
              `Run these agents in parallel via the Agent tool.\n` +
              `Each agent must call sdlc_agent_write with ns, status, summary, and artifacts.\n` +
              `Then call sdlc_dispatch_status to check progress.`,
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "sdlc_dispatch_status",
    "Check how many sub-agents have reported for the current stage dispatch. " +
      "Cross-references .sdlc-dispatch/ record with stage memory. " +
      "Returns pending list and whether gate is ready to run.",
    {
      stage: z.number().int().optional().describe("Stage number. Defaults to cursor.stage."),
      project_root: z.string().optional(),
    },
    async ({ stage, project_root }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const state = readState(root);
        const targetStage = stage ?? state.cursor.stage;
        const stageKey = String(targetStage);
        const stageConfig = state.stages[stageKey];

        if (!stageConfig) {
          return {
            content: [{ type: "text", text: `No stage config for Stage ${targetStage}.` }],
            isError: true,
          };
        }

        const record = readDispatch(root, targetStage);

        const reported = Object.entries(stageConfig.memory)
          .filter(([, v]) => v !== null)
          .map(([k]) => k);
        const pending = Object.entries(stageConfig.memory)
          .filter(([, v]) => v === null)
          .map(([k]) => k);

        const readyToRun = pending.length === 0;

        const lines = [
          `Stage ${targetStage} — ${stageConfig.name}`,
          `Dispatch: ${record?.dispatch_id ?? "(no dispatch record)"}`,
          ``,
          `Reported (${reported.length}): ${reported.join(", ") || "none"}`,
          `Pending  (${pending.length}): ${pending.join(", ") || "none"}`,
          ``,
          readyToRun
            ? `✓ All agents have reported. Call sdlc_gate_run to synthesize the verdict.`
            : `⏳ Waiting for: ${pending.join(", ")}`,
        ];

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );
```

- [ ] **Step 3: Build**

```
cd sdlc-mcp-server && npm run build
```

Expected: clean build.

- [ ] **Step 4: Smoke test**

With a project that has stage 4 configured:
```
# From Claude Code, call the MCP tool:
sdlc_dispatch_agents(stage=4)
# Expected: returns checklist of 4 agents with ns, model, check description
sdlc_dispatch_status(stage=4)
# Expected: "Pending: test_runner, test_files, coverage, ci_gate"
```

- [ ] **Step 5: Commit**

```
git add sdlc-mcp-server/src/server.ts sdlc-mcp-server/dist/
git commit -m "feat: add sdlc_dispatch_agents + sdlc_dispatch_status MCP tools for parallel agent tracking"
```

---

## Task 3: `sdlc tag` CLI — apply region markers to SDLC_VALIDATION.md

**Files:**
- Create: `sdlc-mcp-server/src/tag.ts`
- Modify: `sdlc-mcp-server/package.json`

The `tag` command reads SDLC_VALIDATION.md, finds headings that match `SECTION_MAP` in `template-generator.ts`, and wraps each section with `SDLC:start`/`SDLC:end` tags. It skips sections already tagged.

- [ ] **Step 1: Read SECTION_MAP keys from template-generator.ts**

Open `sdlc-mcp-server/src/template-generator.ts`. The `SECTION_MAP` keys are the exact heading texts. Example:
- `"0. Protocol Rules — Claude must read this first"` → id `protocol-rules`, since `1.0.0`
- `"2. Stage 1 — Inception & Requirements"` → id `stage-1-inception`, pattern `stage`

Note: `stage` pattern means: framework region + empty user sibling. `log` pattern means: framework header + user rows sibling.

- [ ] **Step 2: Write `src/tag.ts`**

```typescript
#!/usr/bin/env node
// sdlc-tag — apply SDLC region markers to an existing SDLC_VALIDATION.md
//
// Usage:
//   sdlc-tag [--project-root=<path>] [--dry-run] [--force]
//
// Wraps each recognised section with SDLC:start/end tags.
// Already-tagged files are safe to re-run (idempotent).

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
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

function sectionBoundaries(
  lines: string[],
  headingLine: number
): { start: number; end: number } {
  // headingLine is 1-indexed. Find the next ## heading at same or higher level.
  const headingText = lines[headingLine - 1];
  const level = headingText.match(/^#+/)?.[0].length ?? 2;
  const pattern = new RegExp(`^#{1,${level}}\\s`);

  let end = lines.length; // default: end of file
  for (let i = headingLine; i < lines.length; i++) {
    if (i > headingLine - 1 && pattern.test(lines[i])) {
      end = i; // exclusive
      break;
    }
  }
  return { start: headingLine - 1, end };
}

async function main(): Promise<void> {
  const { projectRoot, dryRun, force } = parseArgs(process.argv.slice(2));
  const root = resolveProjectRoot(projectRoot);
  const sdlcPath = findSdlcFile(root);

  const raw = readFileSync(sdlcPath, "utf-8");
  const lines = raw.replace(/\r\n/g, "\n").split("\n");

  // Check if already tagged
  const parsed = parseRegions(raw);
  const alreadyTagged = parsed.regions.length > 0;

  if (alreadyTagged && !force) {
    process.stdout.write(
      `${sdlcPath} already has ${parsed.regions.length} region(s).\n` +
      `Run with --force to re-tag (safe — existing tags are preserved).\n`
    );
    process.exit(0);
  }

  // Build output lines
  const out: string[] = [];
  let i = 0;

  // Version marker at top
  const hasVersionMarker = lines.some((l) => l.includes("SDLC:version"));
  if (!hasVersionMarker) {
    out.push(`<!-- SDLC:version "${FRAMEWORK_VERSION}" -->`);
  }

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line is a heading matching SECTION_MAP
    const headingMatch = line.match(/^##\s+(.+)$/);
    const sectionKey = headingMatch ? headingMatch[1].trim() : null;
    const sectionDef = sectionKey ? SECTION_MAP[sectionKey] : null;

    if (sectionDef) {
      const { start, end } = sectionBoundaries(lines, i + 1);
      const sectionLines = lines.slice(start, end);
      const content = sectionLines.join("\n");
      const hash = hashContent(content);

      // Framework region
      out.push(`<!-- SDLC:start type="framework" id="${sectionDef.id}" since="${sectionDef.since}" hash="${hash}" -->`);
      for (const sl of sectionLines) out.push(sl);
      out.push(`<!-- SDLC:end id="${sectionDef.id}" -->`);

      // User sibling for stage/log patterns
      if (sectionDef.pattern === "stage" && sectionDef.customId) {
        out.push(`<!-- SDLC:start type="user" id="${sectionDef.customId}" -->`);
        out.push(`<!-- SDLC:end id="${sectionDef.customId}" -->`);
      } else if (sectionDef.pattern === "log" && sectionDef.customId) {
        out.push(`<!-- SDLC:start type="user" id="${sectionDef.customId}" -->`);
        out.push(`<!-- SDLC:end id="${sectionDef.customId}" -->`);
      }

      i = end; // skip to next unprocessed line
      continue;
    }

    out.push(line);
    i++;
  }

  const result = out.join("\n");

  if (dryRun) {
    process.stdout.write(`[dry-run] Would write ${result.split("\n").length} lines to ${sdlcPath}\n`);
    process.stdout.write(`Sections tagged: ${Object.keys(SECTION_MAP).length}\n`);
    process.exit(0);
  }

  // Backup
  const backupPath = sdlcPath + ".bak";
  copyFileSync(sdlcPath, backupPath);
  process.stdout.write(`Backup: ${backupPath}\n`);

  writeFileSync(sdlcPath, result, "utf-8");
  process.stdout.write(`Tagged: ${sdlcPath}\n`);
  process.stdout.write(`Regions added: ${Object.keys(SECTION_MAP).length} framework + user siblings\n`);
  process.stdout.write(`Backup at: ${backupPath} (delete when satisfied)\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(2);
});
```

- [ ] **Step 3: Export SECTION_MAP from template-generator.ts**

Open `sdlc-mcp-server/src/template-generator.ts`. Verify `SECTION_MAP` is exported. If it's `const SECTION_MAP`, change it to `export const SECTION_MAP`.

- [ ] **Step 4: Add bin entry to package.json**

```json
"bin": {
  "sdlc-mcp-server": "dist/index.js",
  "sdlc": "dist/cli.js",
  "sdlc-audit": "dist/cli.js",
  "sdlc-tag": "dist/tag.js",
  "sdlc-migrate": "dist/migrate.js"
}
```

- [ ] **Step 5: Add tag.ts to tsconfig.json if needed**

Verify `sdlc-mcp-server/tsconfig.json` includes all `src/*.ts` files (check if it uses `"include": ["src/**/*"]` or explicit files). If explicit, add `"src/tag.ts"`.

- [ ] **Step 6: Build**

```
cd sdlc-mcp-server && npm run build
```

Expected: `dist/tag.js` produced, clean build.

- [ ] **Step 7: Dry-run on root SDLC_VALIDATION.md**

```
node sdlc-mcp-server/dist/tag.js --project-root="g:\PROJECT\Learning Projects" --dry-run
```

Expected: `[dry-run] Would write N lines to ...SDLC_VALIDATION.md` with section count.

- [ ] **Step 8: Apply tags**

```
node sdlc-mcp-server/dist/tag.js --project-root="g:\PROJECT\Learning Projects"
```

Expected: `Tagged: ...SDLC_VALIDATION.md`, backup created.

- [ ] **Step 9: Verify tags with parse**

```typescript
// Quick verification — run in node:
import { parseRegions } from "./sdlc-mcp-server/src/regions.js";
import { readFileSync } from "fs";
const content = readFileSync("SDLC_VALIDATION.md", "utf-8");
const result = parseRegions(content);
console.log(`Regions: ${result.regions.length}, Errors: ${result.errors.length}`);
// Expected: 20+ regions, 0 errors
```

- [ ] **Step 10: Commit**

```
git add sdlc-mcp-server/src/tag.ts sdlc-mcp-server/package.json sdlc-mcp-server/dist/ SDLC_VALIDATION.md SDLC_VALIDATION.md.bak
git commit -m "feat: add sdlc-tag CLI and apply region markers to SDLC_VALIDATION.md"
```

---

## Task 4: `sdlc migrate` CLI

**Files:**
- Create: `sdlc-mcp-server/src/migrate.ts`
- Create: `sdlc-mcp-server/migrations/1.0.0-to-1.1.0.ts`

- [ ] **Step 1: Create migrations directory and first script**

```typescript
// sdlc-mcp-server/migrations/1.0.0-to-1.1.0.ts
// Adds sdlc_framework_version, schema bump 1.0 → 1.1, adds waivers if missing.

export function migrate(state: Record<string, unknown>): Record<string, unknown> {
  return {
    ...state,
    schema: "sdlc-state/1.1",
    sdlc_framework_version: "1.1.0",
    waivers: (state["waivers"] as unknown[]) ?? [],
  };
}

export const from = "1.0.0";
export const to = "1.1.0";
export const description = "Add sdlc_framework_version field and waivers array";
```

- [ ] **Step 2: Write `src/migrate.ts`**

```typescript
#!/usr/bin/env node
// sdlc-migrate — run framework version migrations on .sdlc-state.json
//
// Usage:
//   sdlc-migrate --check                    (show what would change)
//   sdlc-migrate --apply                    (apply all pending migrations)
//   sdlc-migrate --rollback                 (restore from most recent backup)
//   sdlc-migrate --project-root=<path>      (optional, defaults to cwd)

import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { resolveProjectRoot } from "./sdlc.js";
import { statePath, FRAMEWORK_VERSION } from "./state.js";

interface MigrationScript {
  from: string;
  to: string;
  description: string;
  migrate: (state: Record<string, unknown>) => Record<string, unknown>;
}

// ── Semver comparison ─────────────────────────────────────────────────────────

function semverLt(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return true;
    if (na > nb) return false;
  }
  return false;
}

// ── Migration registry ────────────────────────────────────────────────────────
// Add new migration objects here as the framework evolves.

const MIGRATIONS: MigrationScript[] = [
  {
    from: "1.0.0",
    to: "1.1.0",
    description: "Add sdlc_framework_version field and waivers array",
    migrate(state) {
      return {
        ...state,
        schema: "sdlc-state/1.1",
        sdlc_framework_version: "1.1.0",
        waivers: (state["waivers"] as unknown[]) ?? [],
      };
    },
  },
];

function migrationPath(from: string, to: string): MigrationScript[] {
  const steps: MigrationScript[] = [];
  let current = from;
  while (semverLt(current, to)) {
    const next = MIGRATIONS.find((m) => m.from === current);
    if (!next) break;
    steps.push(next);
    current = next.to;
  }
  return steps;
}

// ── Backup helpers ────────────────────────────────────────────────────────────

function backupDir(projectRoot: string): string {
  const dir = join(projectRoot, ".sdlc-backups");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function createBackup(projectRoot: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(backupDir(projectRoot), timestamp);
  mkdirSync(dir, { recursive: true });
  const sp = statePath(projectRoot);
  copyFileSync(sp, join(dir, ".sdlc-state.json"));
  return dir;
}

function latestBackup(projectRoot: string): string | null {
  const dir = backupDir(projectRoot);
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir).sort().reverse();
  return entries[0] ? join(dir, entries[0]) : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const apply = argv.includes("--apply");
  const rollback = argv.includes("--rollback");
  const projectRoot = argv.find((x) => x.startsWith("--project-root="))?.split("=")[1];

  const root = resolveProjectRoot(projectRoot);
  const sp = statePath(root);

  if (!existsSync(sp)) {
    process.stderr.write(`No .sdlc-state.json at ${sp}\n`);
    process.exit(2);
  }

  // ── Rollback ────────────────────────────────────────────────────────────────
  if (rollback) {
    const backup = latestBackup(root);
    if (!backup) {
      process.stderr.write("No backups found.\n");
      process.exit(2);
    }
    const backupFile = join(backup, ".sdlc-state.json");
    copyFileSync(backupFile, sp);
    process.stdout.write(`Rolled back from ${backupFile}\n`);
    process.exit(0);
  }

  const raw = JSON.parse(readFileSync(sp, "utf-8")) as Record<string, unknown>;
  const currentVersion = (raw["sdlc_framework_version"] as string | undefined) ?? "1.0.0";
  const targetVersion = FRAMEWORK_VERSION;

  if (!semverLt(currentVersion, targetVersion)) {
    process.stdout.write(`Already at v${currentVersion} — no migration needed.\n`);
    process.exit(0);
  }

  const steps = migrationPath(currentVersion, targetVersion);

  if (steps.length === 0) {
    process.stderr.write(`No migration path from ${currentVersion} to ${targetVersion}.\n`);
    process.exit(2);
  }

  process.stdout.write(`Migration path: ${currentVersion} → ${steps.map((s) => s.to).join(" → ")}\n\n`);
  for (const s of steps) {
    process.stdout.write(`  ${s.from} → ${s.to}: ${s.description}\n`);
  }

  if (check) {
    process.stdout.write(`\nRun with --apply to execute.\n`);
    process.exit(0);
  }

  if (!apply) {
    process.stdout.write(`\nRun with --check to preview or --apply to execute.\n`);
    process.exit(0);
  }

  // ── Apply ───────────────────────────────────────────────────────────────────
  const backupPath = createBackup(root);
  process.stdout.write(`\nBackup: ${backupPath}\n`);

  let state = raw;
  for (const step of steps) {
    state = step.migrate(state);
    process.stdout.write(`✓ Applied ${step.from} → ${step.to}\n`);
  }

  writeFileSync(sp, JSON.stringify(state, null, 2), "utf-8");
  process.stdout.write(`\nMigration complete. Framework version: ${targetVersion}\n`);
  process.stdout.write(`Backup preserved at: ${backupPath}\n`);
  process.stdout.write(`Delete backup when satisfied: Remove-Item -Recurse "${backupPath}"\n`);
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${String(err)}\n`);
  process.exit(2);
});
```

- [ ] **Step 3: Build**

```
cd sdlc-mcp-server && npm run build
```

Expected: `dist/migrate.js` produced, clean build.

- [ ] **Step 4: Test check mode**

```
node sdlc-mcp-server/dist/migrate.js --project-root="g:\PROJECT\Learning Projects" --check
```

Expected output (since state.json already has `sdlc_framework_version: "1.1.0"`):
```
Already at v1.1.0 — no migration needed.
```

- [ ] **Step 5: Test against a v1.0.0 state**

Create a temp state file missing `sdlc_framework_version`, run `--check`, verify it shows the migration path.

- [ ] **Step 6: Commit**

```
git add sdlc-mcp-server/src/migrate.ts sdlc-mcp-server/dist/ sdlc-mcp-server/migrations/
git commit -m "feat: add sdlc-migrate CLI with backup/rollback and 1.0.0→1.1.0 migration script"
```

---

## Task 5: Stage configs for stages 1–3, 6–10 in `.sdlc-state.json`

**Files:**
- Modify: `.sdlc-state.json` (root)

Reference: `sdlc-validate-inventory.md` for agent assignments per stage.

- [ ] **Step 1: Open `.sdlc-state.json` and add stage configs**

Add the following to the `"stages"` object, alongside the existing `"4"` and `"5"` entries:

```json
"1": {
  "name": "Inception & Requirements",
  "sdlc_heading": "2. Stage 1 — Inception & Requirements",
  "imports": [],
  "sub_agents": [
    { "id": "spec-file-finder",    "check": "docs/spec.md exists with FR-x.y.z identifiers and NFRs quantified", "model": "haiku",   "ns": "spec_docs" },
    { "id": "scope-grep-checker",  "check": "In-scope and out-of-scope table present; personas defined",          "model": "haiku",   "ns": "scope_table" },
    { "id": "req-boundary-check",  "check": "FR identifiers follow consistent naming pattern across all FRs",     "model": "sonnet",  "ns": "req_consistency" }
  ],
  "gate": {
    "rule": "all_criteria_met",
    "criteria": [
      { "ns": "spec_docs",        "must": "pass" },
      { "ns": "scope_table",      "must": "pass" },
      { "ns": "req_consistency",  "must": "pass_or_acknowledge" }
    ],
    "conflict_threshold": 2
  },
  "memory": { "spec_docs": null, "scope_table": null, "req_consistency": null }
},
"2": {
  "name": "Architecture & Design",
  "sdlc_heading": "3. Stage 2 — Architecture & Design",
  "imports": [
    { "stage": 1, "key": "scope_summary" }
  ],
  "sub_agents": [
    { "id": "arch-file-finder",    "check": "docs/architecture.md and docs/decisions.md (ADRs) exist",       "model": "haiku",   "ns": "arch_docs" },
    { "id": "boundary-analyzer",   "check": "Module boundaries clean — no cross-domain imports, no DB in frontend", "model": "sonnet", "ns": "module_boundaries" },
    { "id": "adr-grep-checker",    "check": "At least 3 ADRs documented; each has context, decision, consequences", "model": "haiku",  "ns": "adr_quality" }
  ],
  "gate": {
    "rule": "all_criteria_met",
    "criteria": [
      { "ns": "arch_docs",         "must": "pass" },
      { "ns": "module_boundaries", "must": "pass" },
      { "ns": "adr_quality",       "must": "pass_or_acknowledge" }
    ],
    "conflict_threshold": 2
  },
  "memory": { "arch_docs": null, "module_boundaries": null, "adr_quality": null }
},
"3": {
  "name": "Development Practices & Standards",
  "sdlc_heading": "4. Stage 3 — Development Practices & Standards",
  "imports": [],
  "sub_agents": [
    { "id": "config-reader",         "check": "ESLint config exists; tsconfig.json has strict:true and noImplicitAny:true", "model": "haiku",  "ns": "linter_config" },
    { "id": "dep-scanner",           "check": "package-lock.json committed; no known vulnerable deps",                      "model": "haiku",  "ns": "deps" },
    { "id": "ts-ignore-grep",        "check": "No @ts-ignore without explanation comment",                                  "model": "haiku",  "ns": "ts_hygiene" },
    { "id": "pattern-checker",       "check": "Consistent error handling, naming, and import patterns across codebase",     "model": "sonnet", "ns": "patterns" }
  ],
  "gate": {
    "rule": "all_criteria_met",
    "criteria": [
      { "ns": "linter_config", "must": "pass" },
      { "ns": "deps",          "must": "pass_or_acknowledge" },
      { "ns": "ts_hygiene",    "must": "pass" },
      { "ns": "patterns",      "must": "pass_or_acknowledge" }
    ],
    "conflict_threshold": 2
  },
  "memory": { "linter_config": null, "deps": null, "ts_hygiene": null, "patterns": null }
},
"6": {
  "name": "Deployment & Release",
  "sdlc_heading": "7. Stage 6 — Deployment & Release",
  "imports": [
    { "stage": 5, "key": "ci_test_command" }
  ],
  "sub_agents": [
    { "id": "deploy-config-reader", "check": "Deployment config exists (Amplify/SAM/CDK); staging env defined",   "model": "haiku",  "ns": "deploy_config" },
    { "id": "iac-grep-checker",     "check": "Infrastructure-as-code present; no manual console steps in runbook", "model": "haiku",  "ns": "iac" },
    { "id": "secret-scanner",       "check": "No hardcoded secrets in IaC or deployment scripts",                  "model": "haiku",  "ns": "secrets" },
    { "id": "rollback-checker",     "check": "Rollback procedure documented and tested in staging",                 "model": "sonnet", "ns": "rollback" }
  ],
  "gate": {
    "rule": "all_criteria_met",
    "criteria": [
      { "ns": "deploy_config", "must": "pass" },
      { "ns": "iac",           "must": "pass_or_acknowledge" },
      { "ns": "secrets",       "must": "pass" },
      { "ns": "rollback",      "must": "pass_or_acknowledge" }
    ],
    "conflict_threshold": 2
  },
  "memory": { "deploy_config": null, "iac": null, "secrets": null, "rollback": null }
},
"7": {
  "name": "Observability & Operations",
  "sdlc_heading": "8. Stage 7 — Observability & Operations",
  "imports": [],
  "sub_agents": [
    { "id": "logging-config-reader", "check": "Structured logging configured; log levels per environment",      "model": "haiku",  "ns": "logging" },
    { "id": "metrics-grep-checker",  "check": "Metrics instrumentation present for critical paths",             "model": "haiku",  "ns": "metrics" },
    { "id": "runbook-file-finder",   "check": "Runbooks exist for on-call scenarios (deploy, rollback, alerts)", "model": "haiku",  "ns": "runbooks" },
    { "id": "alert-config-reader",   "check": "Alerting rules defined; p95 latency and error-rate thresholds set", "model": "sonnet", "ns": "alerts" }
  ],
  "gate": {
    "rule": "all_criteria_met",
    "criteria": [
      { "ns": "logging",  "must": "pass" },
      { "ns": "metrics",  "must": "pass_or_acknowledge" },
      { "ns": "runbooks", "must": "pass_or_acknowledge" },
      { "ns": "alerts",   "must": "pass_or_acknowledge" }
    ],
    "conflict_threshold": 2
  },
  "memory": { "logging": null, "metrics": null, "runbooks": null, "alerts": null }
},
"8": {
  "name": "Security",
  "sdlc_heading": "9. Stage 8 — Security",
  "imports": [
    { "stage": 2, "key": "auth_pattern" },
    { "stage": 2, "key": "rls_pattern" }
  ],
  "sub_agents": [
    { "id": "secret-scanner",      "check": "No secrets in codebase, git history clean",                          "model": "haiku",  "ns": "secrets" },
    { "id": "auth-boundary-check", "check": "JWT verification present in every Lambda; RLS set before every query", "model": "sonnet", "ns": "auth_boundary" },
    { "id": "dep-vuln-scanner",    "check": "npm audit clean or all vulnerabilities acknowledged",                  "model": "haiku",  "ns": "dep_vulns" },
    { "id": "input-val-grep",      "check": "Input validation at all API entry points; no raw SQL string concat",   "model": "haiku",  "ns": "input_validation" }
  ],
  "gate": {
    "rule": "all_criteria_met",
    "criteria": [
      { "ns": "secrets",          "must": "pass" },
      { "ns": "auth_boundary",    "must": "pass" },
      { "ns": "dep_vulns",        "must": "pass_or_acknowledge" },
      { "ns": "input_validation", "must": "pass" }
    ],
    "conflict_threshold": 2
  },
  "memory": { "secrets": null, "auth_boundary": null, "dep_vulns": null, "input_validation": null }
},
"9": {
  "name": "Performance & Scale",
  "sdlc_heading": "10. Stage 9 — Performance & Scale",
  "imports": [],
  "sub_agents": [
    { "id": "load-test-grep",       "check": "Load test scripts exist; p95 latency target defined and tested",     "model": "haiku",  "ns": "load_tests" },
    { "id": "perf-pattern-checker", "check": "No N+1 queries; pagination present on list endpoints; cache headers set", "model": "sonnet", "ns": "perf_patterns" },
    { "id": "db-index-grep",        "check": "Indexes on all foreign keys and frequent query columns",              "model": "haiku",  "ns": "db_indexes" }
  ],
  "gate": {
    "rule": "all_criteria_met",
    "criteria": [
      { "ns": "load_tests",    "must": "pass_or_acknowledge" },
      { "ns": "perf_patterns", "must": "pass" },
      { "ns": "db_indexes",    "must": "pass_or_acknowledge" }
    ],
    "conflict_threshold": 2
  },
  "memory": { "load_tests": null, "perf_patterns": null, "db_indexes": null }
},
"10": {
  "name": "Data & Analytics Engineering",
  "sdlc_heading": "11. Stage 10 — Data & Analytics Engineering",
  "imports": [],
  "sub_agents": [
    { "id": "data-contract-grep",  "check": "Data contracts (schemas) defined for all event types emitted",       "model": "haiku",  "ns": "data_contracts" },
    { "id": "analytics-pattern",   "check": "Analytics events follow consistent naming and property conventions", "model": "sonnet", "ns": "analytics_patterns" },
    { "id": "pii-grep-checker",    "check": "No PII in analytics events or logs; PII handling documented",        "model": "haiku",  "ns": "pii_handling" }
  ],
  "gate": {
    "rule": "all_criteria_met",
    "criteria": [
      { "ns": "data_contracts",    "must": "pass_or_acknowledge" },
      { "ns": "analytics_patterns","must": "pass_or_acknowledge" },
      { "ns": "pii_handling",      "must": "pass" }
    ],
    "conflict_threshold": 2
  },
  "memory": { "data_contracts": null, "analytics_patterns": null, "pii_handling": null }
}
```

- [ ] **Step 2: Verify JSON is valid**

```powershell
node -e "JSON.parse(require('fs').readFileSync('.sdlc-state.json', 'utf-8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```
git add .sdlc-state.json
git commit -m "feat: add sub-agent configs for all 10 SDLC stages in root state.json"
```

---

## Task 6: Verify integration skills

**Files:**
- Read + possibly modify: `plugin/skills/sdlc-superpowers.md`, `sdlc-playwright.md`, `sdlc-context7.md`, `sdlc-figma.md`, `sdlc-frontend-design.md`

- [ ] **Step 1: Read each skill and verify MCP tool references**

For each skill file, check:
- Any MCP tool name referenced (e.g., `check_gate_status`, `sdlc_agent_write`) exists in the 20-tool list from `server.ts`
- Any CLI command referenced (e.g., `sdlc tag`, `sdlc migrate`) exists after this plan
- Any skill cross-reference (e.g., `superpowers:brainstorming`) is a real skill

Known MCP tools: `load_sdlc_context`, `check_gate_status`, `get_project_identity`, `read_sdlc_section`, `log_decision`, `log_open_item`, `update_session_log`, `verify_artifact`, `init_project`, `sdlc_skills_fetch`, `sdlc_state_create`, `sdlc_init`, `sdlc_agent_write`, `sdlc_gate_run`, `sdlc_gate_waive`, `sdlc_release_lock`, `sdlc_signoff`, `sdlc_doctor`, `sdlc_task_checkpoint`, `sdlc_error_diagnose`, `sdlc_dispatch_agents`, `sdlc_dispatch_status`

- [ ] **Step 2: For any skill referencing a non-existent tool, update the reference**

If a skill says `sdlc_dispatch_batch` (old name) and the real tool is `sdlc_dispatch_agents`, update the reference in the skill file.

- [ ] **Step 3: Commit any updates**

```
git add plugin/skills/
git commit -m "fix: update integration skill files to reference correct MCP tool names"
```

---

## Execution order

These tasks are mostly independent, but the recommended order is:

1. Task 1 (dispatch.ts types) — prerequisite for Task 2
2. Task 2 (dispatch MCP tools) — depends on Task 1
3. Task 3 (sdlc tag CLI) — independent
4. Task 4 (sdlc migrate CLI) — independent
5. Task 5 (stage configs) — independent, can be done now
6. Task 6 (skill verification) — last, after tools are confirmed

---

## Self-review

**Spec coverage:**
- MCP dispatch tools ✓ (Tasks 1–2)
- Skills ✓ (Task 6 verifies existing, no new skills needed)
- Agents ✓ (Task 5 configures all 10 stages)
- Region markers ✓ (Task 3)
- HMAC ✓ (already built — no task needed)
- CLI ✓ (Tasks 3–4)
- Integrations ✓ (Task 6)

**Placeholder scan:** No TBD or TODO in task steps. All code blocks are complete.

**Type consistency:** `DispatchRecord`, `DispatchAgent` defined in Task 1, imported in Task 2. `SECTION_MAP` exported in Task 3 step 3. `FRAMEWORK_VERSION` imported from `state.js` (already exported at line 5).
