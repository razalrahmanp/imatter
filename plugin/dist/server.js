import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { resolveProjectRoot, findSdlcFile, readSdlcContent, getGateStatuses, getSdlcSection, appendTableRow, artifactInfo, regenerateQuickReference, } from "./sdlc.js";
import { ensureKey, acquireLock, releaseLock, fileHash } from "./integrity.js";
import { FRAMEWORK_VERSION, readState, writeState, ensureSessionDir, parseFrontmatter, extractExport, runGateSynthesis, readTask, writeTask, taskDir, diagnoseError, } from "./state.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ── Section 0 protocol rules shipped as a reusable constant ───────────────────
const PROTOCOL_RULES = `# SDLC Validation Protocol — Section 0

These rules govern every action you take in this repository. They are not suggestions.

## 0.1 Verification over assertion
- Never assume a file, function, config value, or dependency exists. Read it or grep for it.
- Every finding must be cited as file:line. A finding with no citation is not a finding.
- Anything you cannot verify from the codebase is UNVERIFIED — say so and ask.

## 0.2 Gate discipline (CRITICAL — enforced by check_gate_status tool)
- Before starting work in any stage, call check_gate_status for that stage.
- Do NOT write implementation code until check_gate_status returns status PASSED.
- Do NOT mark a gate PASSED unless every criterion has a file:line citation or explicit user confirmation.
- If a prerequisite gate is NOT STARTED or IN PROGRESS, stop and state what is missing.

## 0.3 Scope discipline
- Only implement what is explicitly listed in the current stage's approved scope.
- Out-of-scope issues go in Section 16 via log_open_item — never fixed silently.

## 0.4 Decision discipline
- Call log_decision before acting on any significant decision.
- Do not re-litigate logged decisions without raising the conflict explicitly.

## 0.5 Deviation protocol
- If the codebase contradicts a PASSED gate, the code wins.
- Flag the conflict explicitly and ask the user how to resolve it before proceeding.

## 0.6 Forbidden without explicit user approval
Creating new files outside agreed structure · changing DB schema · adding/removing dependencies ·
modifying CI/CD · touching auth/authz logic · external API calls · deleting or renaming files ·
committing, pushing, or opening pull requests.

## Session startup (run automatically every session)
1. Call get_project_identity — fill placeholders from the repo, present to user.
2. Call check_gate_status (no stage arg) — show all gate statuses.
3. Ask the user what they want to work on.
4. Before writing any code, call check_gate_status for the relevant stage.

## Session end
Call update_session_log before closing — work done, gates changed, next step.`;
// ─────────────────────────────────────────────────────────────────────────────
export function createServer() {
    const server = new McpServer({ name: "sdlc-validation", version: "1.0.0" });
    // ── TOOLS ──────────────────────────────────────────────────────────────────
    server.tool("load_sdlc_context", "Load the full SDLC_VALIDATION.md into Claude's context. " +
        "Called automatically by the SessionStart hook — Claude is bound by the rules it contains.", { project_root: z.string().optional() }, async ({ project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const sdlcPath = findSdlcFile(root);
            const content = readSdlcContent(sdlcPath);
            const statuses = getGateStatuses(content);
            const blocked = statuses.filter((s) => s.stage <= 10 && s.status !== "PASSED" && s.status !== "ONGOING");
            const gateNote = blocked.length > 0
                ? `\n\n⚠ GATES NOT PASSED: Stages ${blocked.map((s) => s.stage).join(", ")} are not yet PASSED. ` +
                    `Do NOT write implementation code for those stages.`
                : `\n\n✓ All gates passed or ongoing.`;
            return {
                content: [
                    {
                        type: "text",
                        text: `SDLC_VALIDATION.md loaded from ${sdlcPath}\n` +
                            `You are bound by every rule in this document for this session.\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                            content +
                            gateNote,
                    },
                ],
            };
        }
        catch (err) {
            return {
                content: [{ type: "text", text: `No SDLC_VALIDATION.md found: ${err}` }],
                isError: true,
            };
        }
    });
    server.tool("check_gate_status", "Check whether an SDLC stage gate is PASSED. Always call before writing code for a stage. " +
        "Returns isError:true when the gate is not yet passed so Claude stops and reports to the user.", {
        stage: z
            .number()
            .int()
            .min(1)
            .max(13)
            .optional()
            .describe("Stage number 1–10 (named stages) or 12–13 (cross-cutting). Omit to get all stages."),
        project_root: z
            .string()
            .optional()
            .describe("Absolute path to project root. Auto-detected from SDLC_PROJECT_ROOT env var or cwd if omitted."),
    }, async ({ stage, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const sdlcPath = findSdlcFile(root);
            const content = readSdlcContent(sdlcPath);
            const statuses = getGateStatuses(content);
            if (stage !== undefined) {
                const s = statuses.find((g) => g.stage === stage);
                if (!s) {
                    return {
                        content: [{ type: "text", text: `Stage ${stage} not found in ${sdlcPath}.` }],
                        isError: true,
                    };
                }
                const passed = s.status === "PASSED" || s.status === "ONGOING";
                return {
                    content: [
                        {
                            type: "text",
                            text: passed
                                ? `GATE OK — Stage ${stage} (${s.name}): ${s.status}${s.passedDate ? ` since ${s.passedDate}` : ""}. You may proceed.`
                                : `GATE BLOCKED — Stage ${stage} (${s.name}): ${s.status}.\n\n` +
                                    `You must NOT write implementation code for this stage until this gate is PASSED.\n` +
                                    `Present this status to the user, read the gate section in the SDLC file, ` +
                                    `and ask what they want to do next.`,
                        },
                    ],
                    isError: !passed,
                };
            }
            // All stages
            const rows = statuses
                .map((s) => `| ${s.stage} | ${s.name} | \`${s.status}\` | ${s.passedDate ?? ""} |`)
                .join("\n");
            const blocked = statuses.filter((s) => s.stage <= 10 && s.status !== "PASSED" && s.status !== "ONGOING");
            const summary = blocked.length > 0
                ? `\n⚠ ${blocked.length} gate(s) not yet PASSED: ${blocked.map((s) => `Stage ${s.stage}`).join(", ")}`
                : `\n✓ All named-stage gates are PASSED or ONGOING.`;
            return {
                content: [
                    {
                        type: "text",
                        text: `SDLC Gate Status — ${sdlcPath}\n\n` +
                            `| Stage | Name | Status | Passed |\n|---|---|---|---|\n${rows}` +
                            summary,
                    },
                ],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("get_project_identity", "Read Section 1 (Project Identity) from the SDLC file. Call this at session start to fill placeholders.", {
        project_root: z.string().optional(),
    }, async ({ project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const sdlcPath = findSdlcFile(root);
            const section = getSdlcSection(readSdlcContent(sdlcPath), "1. Project Identity");
            return { content: [{ type: "text", text: `Source: ${sdlcPath}\n\n${section}` }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("read_sdlc_section", "Read a specific section of SDLC_VALIDATION.md by its heading number and title.", {
        heading: z
            .string()
            .describe("The heading text after '## ', e.g. '2. Stage 1 — Inception & Requirements' or '15. Decision Log'"),
        project_root: z.string().optional(),
    }, async ({ heading, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const sdlcPath = findSdlcFile(root);
            const section = getSdlcSection(readSdlcContent(sdlcPath), heading);
            return { content: [{ type: "text", text: section }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("log_decision", "Append a row to Section 15 (Decision Log). Must be called before acting on any significant decision.", {
        stage: z.number().int().describe("Stage number this decision belongs to"),
        decision: z.string().describe("The decision made"),
        rationale: z.string().describe("Why this decision was made"),
        alternatives: z.string().optional().describe("Alternatives that were considered (use '—' if none)"),
        approved_by: z.string().optional().describe("Who approved the decision"),
        project_root: z.string().optional(),
    }, async ({ stage, decision, rationale, alternatives, approved_by, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const sdlcPath = findSdlcFile(root);
            const date = new Date().toISOString().slice(0, 10);
            const row = `| ${date} | ${stage} | ${decision} | ${rationale} | ${alternatives ?? "—"} | ${approved_by ?? "pending"} |`;
            const { lineNumber } = appendTableRow(sdlcPath, "15. Decision Log", row);
            return {
                content: [{ type: "text", text: `Decision logged at ${sdlcPath}:${lineNumber}` }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("log_open_item", "Append an out-of-scope issue to Section 16 (Open Items). Use instead of silently fixing unrelated issues.", {
        description: z.string().describe("Description of the issue"),
        priority: z.enum(["high", "medium", "low"]),
        stage: z.number().int().optional().describe("Stage where the issue was found"),
        assigned_to: z.string().optional(),
        project_root: z.string().optional(),
    }, async ({ description, priority, stage, assigned_to, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const sdlcPath = findSdlcFile(root);
            const date = new Date().toISOString().slice(0, 10);
            const row = `| ${date} | ${stage ?? "—"} | ${description} | ${priority} | ${assigned_to ?? "—"} |`;
            const { lineNumber } = appendTableRow(sdlcPath, "16. Open Items", row);
            return {
                content: [{ type: "text", text: `Open item logged at ${sdlcPath}:${lineNumber}` }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("update_session_log", "Append a one-line entry to Section 18 (Session Log). Call before ending every session. " +
        "Use log_level=minimal for sensitive projects to avoid committing implementation details to git.", {
        work_done: z.string().describe("What was accomplished this session"),
        gates_changed: z
            .string()
            .optional()
            .describe("Which gate statuses changed this session, or 'none'"),
        next_step: z.string().describe("What the next session should start with"),
        log_level: z
            .enum(["minimal", "normal", "verbose"])
            .optional()
            .describe("minimal: omit work_done details (logs 'Session completed'); " +
            "normal (default): standard one-liner; " +
            "verbose: full work_done + next_step"),
        project_root: z.string().optional(),
    }, async ({ work_done, gates_changed, next_step, log_level, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const sdlcPath = findSdlcFile(root);
            const date = new Date().toISOString().slice(0, 10);
            let rowWorkDone;
            let rowNextStep;
            if (log_level === "minimal") {
                rowWorkDone = "Session completed";
                rowNextStep = "(see task log)";
            }
            else {
                rowWorkDone = work_done;
                rowNextStep = next_step;
            }
            const row = `| ${date} | ${rowWorkDone} | ${gates_changed ?? "none"} | ${rowNextStep} |`;
            const { lineNumber } = appendTableRow(sdlcPath, "18. Session Log", row);
            return {
                content: [{ type: "text", text: `Session log updated at ${sdlcPath}:${lineNumber}` }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("verify_artifact", "Check whether a required SDLC artifact file or directory exists. Returns a file:line citation for gate evidence.", {
        artifact_path: z
            .string()
            .describe("Path relative to project_root, or absolute. e.g. 'docs/spec.md' or 'src/'"),
        project_root: z.string().optional(),
    }, async ({ artifact_path, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const info = artifactInfo(artifact_path, root);
            if (!info.exists) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `ARTIFACT MISSING: ${info.fullPath}\n` +
                                `This artifact must exist before the gate can be marked PASSED.`,
                        },
                    ],
                    isError: true,
                };
            }
            const ref = info.isDir
                ? `${info.fullPath} (directory)`
                : `${info.fullPath}:1 (${info.lineCount} lines)`;
            return {
                content: [{ type: "text", text: `ARTIFACT EXISTS: ${ref}` }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("init_project", "Copy the bundled SDLC_VALIDATION.md template into the project root. " +
        "Run this once when starting a new project — never overwrites an existing file.", { project_root: z.string().optional() }, async ({ project_root }) => {
        const root = resolveProjectRoot(project_root);
        const dest = path.join(root, "SDLC_VALIDATION.md");
        if (fs.existsSync(dest)) {
            return {
                content: [{ type: "text", text: `SDLC_VALIDATION.md already exists at ${dest} — not overwritten.` }],
            };
        }
        const templatePath = path.join(__dirname, "..", "template", "SDLC_VALIDATION.md");
        if (!fs.existsSync(templatePath)) {
            return {
                content: [{ type: "text", text: `Template not found at ${templatePath}` }],
                isError: true,
            };
        }
        fs.copyFileSync(templatePath, dest);
        return {
            content: [
                {
                    type: "text",
                    text: `SDLC_VALIDATION.md created at ${dest}\n\n` +
                        `Next: tell me about your project and I will fill in Section 1 (Project Identity) from your repo.`,
                },
            ],
        };
    });
    // ── SKILLS TOOL ───────────────────────────────────────────────────────────
    server.tool("sdlc_skills_fetch", "Fetch a skill's pattern summary from the registry. " +
        "Resolves through layers: compliance → project overlay → stack profile → practice → generic → flat fallback. " +
        "Returns only the first '## Pattern Summary' section (~200 tokens) — never the full file. " +
        "Use task_type='list' to enumerate all available skills with their layer and tags.", {
        task_type: z
            .string()
            .describe("Skill id (file name without extension), e.g. 'lambda-handler', 'api-endpoint-design'. " +
            "Use 'list' to list all skills across all registry layers."),
        tags: z
            .array(z.string())
            .optional()
            .describe("Only return the skill if it matches ALL of these tags (frontmatter filter)."),
        module: z
            .string()
            .optional()
            .describe("Extract the matching ### subsection from Full Reference for this module name."),
        project_root: z.string().optional(),
    }, async ({ task_type, tags, module: mod, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const skillsDir = path.join(root, "skills");
            const stackConfigPath = path.join(root, ".sdlc-stack.json");
            const stackConfig = fs.existsSync(stackConfigPath)
                ? JSON.parse(fs.readFileSync(stackConfigPath, "utf-8"))
                : {};
            // Ordered search paths — highest priority first
            const searchPaths = [
                // Compliance modules (one dir per active module)
                ...((stackConfig.compliance ?? []).map((m) => ({
                    layer: `compliance/${m}`,
                    dir: path.join(skillsDir, "compliance", m),
                }))),
                // Project overlay
                ...(stackConfig.project_overlay ? [{
                        layer: `project/${stackConfig.project_overlay}`,
                        dir: path.join(skillsDir, "project", stackConfig.project_overlay),
                    }] : []),
                // Stack profile
                ...(stackConfig.stack ? [{
                        layer: `stack/${stackConfig.stack}`,
                        dir: path.join(skillsDir, "stack", stackConfig.stack),
                    }] : []),
                // Practice and generic
                { layer: "practice", dir: path.join(skillsDir, "practice") },
                { layer: "generic", dir: path.join(skillsDir, "generic") },
                // Flat fallback (legacy / pre-registry)
                { layer: "flat", dir: skillsDir },
            ];
            // ── Helper: extract first ## section ─────────────────────────────────
            function extractSummary(content) {
                const lines = content.split(/\r?\n/);
                const out = [];
                let inSummary = false, count = 0;
                for (const line of lines) {
                    if (line.startsWith("## ")) {
                        count++;
                        if (count === 1) {
                            inSummary = true;
                            out.push(line);
                            continue;
                        }
                        if (count === 2)
                            break;
                    }
                    if (inSummary)
                        out.push(line);
                }
                return out.length > 0
                    ? out.join("\n").trim()
                    : lines.filter((l) => !l.startsWith("---") && l.trim()).slice(0, 30).join("\n").trim();
            }
            function parseFm(content) {
                return content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? null;
            }
            // ── List mode ─────────────────────────────────────────────────────────
            if (task_type === "list") {
                const entries = [];
                const seen = new Set();
                for (const { layer, dir } of searchPaths) {
                    if (!fs.existsSync(dir))
                        continue;
                    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !seen.has(f));
                    for (const f of files) {
                        seen.add(f);
                        const raw = fs.readFileSync(path.join(dir, f), "utf-8");
                        const fm = parseFm(raw);
                        const title = fm?.match(/^title:\s*"?([^"\n]+)"?/m)?.[1] ?? "";
                        const tagsLine = fm?.match(/^tags:\s*(\[.+\])/m)?.[1] ?? "";
                        entries.push(`  [${layer}] ${f.replace(".md", "").padEnd(30)} ${title} ${tagsLine}`);
                    }
                }
                return {
                    content: [{
                            type: "text",
                            text: entries.length > 0
                                ? `Skills registry (${entries.length} skills, ${searchPaths.filter((p) => fs.existsSync(p.dir)).length} active layers):\n${entries.join("\n")}`
                                : `No skills found. Create a skills/ directory at ${root}.`,
                        }],
                };
            }
            // ── Skill resolution ──────────────────────────────────────────────────
            let resolvedPath = null;
            let resolvedLayer = null;
            for (const { layer, dir } of searchPaths) {
                const candidate = path.join(dir, `${task_type}.md`);
                if (fs.existsSync(candidate)) {
                    resolvedPath = candidate;
                    resolvedLayer = layer;
                    break;
                }
            }
            if (!resolvedPath) {
                // Collect all available skill ids for the error message
                const all = new Set();
                for (const { dir } of searchPaths) {
                    if (fs.existsSync(dir)) {
                        fs.readdirSync(dir).filter((f) => f.endsWith(".md")).forEach((f) => all.add(f.replace(".md", "")));
                    }
                }
                return {
                    content: [{
                            type: "text",
                            text: `Skill "${task_type}" not found in registry.\n` +
                                (all.size > 0
                                    ? `Available: ${[...all].sort().join(", ")}`
                                    : `No skills library found. Create skills/ directory at ${root}.`),
                        }],
                    isError: true,
                };
            }
            const content = fs.readFileSync(resolvedPath, "utf-8");
            const fm = parseFm(content);
            // ── Tag filter ────────────────────────────────────────────────────────
            if (tags?.length && fm) {
                const tagsLine = fm.match(/^tags:\s*(\[.+\])/m)?.[1];
                const skillTags = tagsLine ? JSON.parse(tagsLine) : [];
                const missing = tags.filter((t) => !skillTags.includes(t));
                if (missing.length > 0) {
                    return {
                        content: [{
                                type: "text",
                                text: `Skill "${task_type}" [${resolvedLayer}] does not match tags: ${missing.join(", ")}. Skill tags: ${skillTags.join(", ")}`,
                            }],
                        isError: true,
                    };
                }
            }
            const summary = extractSummary(content);
            const moduleNote = mod
                ? content.match(new RegExp(`(?:^|\\n)(?:###[^\\n]*${mod}[^\\n]*)\\n([\\s\\S]*?)(?=\\n###|\\n##|$)`, "i"))?.[0]
                : null;
            const related = fm?.match(/^related:\s*(\[.+\])/m)?.[1];
            return {
                content: [{
                        type: "text",
                        text: `Skill: ${task_type} [${resolvedLayer}]\n` +
                            (mod ? `Module filter: ${mod}\n` : "") +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            summary +
                            (moduleNote ? `\n\nModule-specific note:\n${moduleNote.trim()}` : "") +
                            (related ? `\nRelated skills: ${related}` : ""),
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    // ── ORCHESTRATION TOOLS ────────────────────────────────────────────────────
    server.tool("sdlc_state_create", "Initialize .sdlc-state.json for a project. Run once per project before any stage work. " +
        "Reads the Quick Reference table in SDLC_VALIDATION.md to discover all stages and sets the " +
        "cursor to the first NOT STARTED stage. Never overwrites an existing state file.", { project_root: z.string().optional() }, async ({ project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const stateFile = path.join(root, ".sdlc-state.json");
            if (fs.existsSync(stateFile)) {
                return { content: [{ type: "text", text: `.sdlc-state.json already exists at ${stateFile} — not overwritten.` }] };
            }
            const sdlcPath = findSdlcFile(root);
            const content = readSdlcContent(sdlcPath);
            const statuses = getGateStatuses(content);
            // Cursor points to the first NOT STARTED or IN PROGRESS stage
            const firstOpen = statuses.find((s) => s.status !== "PASSED" && s.status !== "ONGOING");
            const cursorStage = firstOpen?.stage ?? (statuses[statuses.length - 1]?.stage ?? 1);
            const state = {
                schema: "sdlc-state/1.1",
                sdlc_framework_version: FRAMEWORK_VERSION,
                project_root: root,
                sdlc_file: sdlcPath,
                cursor: {
                    stage: cursorStage,
                    status: "in_progress",
                    fail_count: 0,
                    started_at: new Date().toISOString(),
                },
                history: [],
                stages: {},
                flagged: [],
                waivers: [],
            };
            writeState(root, state);
            ensureSessionDir(root);
            // Generate HMAC key — stored in .sdlc/keys/state.key (never committed)
            ensureKey(root);
            // Add key directory to .gitignore if it isn't already
            const gitignorePath = path.join(root, ".gitignore");
            const keyIgnoreEntry = ".sdlc/keys/";
            if (fs.existsSync(gitignorePath)) {
                const gi = fs.readFileSync(gitignorePath, "utf-8");
                if (!gi.includes(keyIgnoreEntry)) {
                    fs.appendFileSync(gitignorePath, `\n${keyIgnoreEntry}\n`, "utf-8");
                }
            }
            const summary = statuses
                .map((s) => `  Stage ${s.stage} (${s.name}): ${s.status}`)
                .join("\n");
            return {
                content: [{
                        type: "text",
                        text: `Created ${stateFile}\n` +
                            `Integrity key generated at .sdlc/keys/state.key (added to .gitignore).\n` +
                            `Cursor set to Stage ${cursorStage}.\n\n` +
                            `Discovered stages:\n${summary}\n\n` +
                            `Next: call sdlc_init to load context for Stage ${cursorStage}, ` +
                            `then define its sub_agents via sdlc_stage_configure if not already set.`,
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("sdlc_init", "Assemble the session context for the current (or specified) stage. " +
        "Returns a fixed-budget payload regardless of how many stages have cleared: " +
        "cursor, one-line history summaries, named import values (frontmatter only), " +
        "the SDLC section for this stage, and the stage's sub-agent + gate config.", {
        project_root: z.string().optional(),
        stage: z.number().int().optional().describe("Override cursor stage. Omit to use cursor.stage."),
    }, async ({ project_root, stage }) => {
        try {
            const root = resolveProjectRoot(project_root);
            // Acquire session lock — refuse if another live session holds it
            const sessionId = crypto.randomUUID();
            const lockResult = acquireLock(root, sessionId);
            if (!lockResult.acquired) {
                const c = lockResult.conflict;
                return {
                    content: [{
                            type: "text",
                            text: `LOCK CONFLICT — another session holds the SDLC state lock.\n` +
                                `Session: ${c.session_id} | PID ${c.pid} on ${c.host} | started ${c.started_at}\n\n` +
                                `If that session is gone, delete .sdlc-state.lock and retry.`,
                        }],
                    isError: true,
                };
            }
            const lockNote = lockResult.takenOver ? " (stale lock cleared)" : "";
            const state = readState(root);
            const targetStage = stage ?? state.cursor.stage;
            // Framework version mismatch warning
            const stateVersion = state.sdlc_framework_version ?? "1.0.0";
            const versionNote = stateVersion !== FRAMEWORK_VERSION
                ? `\n⚠ Framework version mismatch: state was created with v${stateVersion}, current is v${FRAMEWORK_VERSION}. Run sdlc_doctor for details.`
                : "";
            // Regenerate QR table so it reflects current state (Defense 3)
            try {
                regenerateQuickReference(state, state.sdlc_file);
            }
            catch { /* best effort */ }
            // Check flagged queue first
            if (state.flagged.includes(targetStage)) {
                return {
                    content: [{
                            type: "text",
                            text: `Stage ${targetStage} is in the flagged queue — it has failed ${state.cursor.fail_count} times.\n` +
                                `Human review required before proceeding. Remove from flagged[] in .sdlc-state.json to unblock.`,
                        }],
                    isError: true,
                };
            }
            // 1. History summaries — compact, flat, never loads full docs
            const historySummaries = state.history.map((h) => `Stage ${h.stage} (${h.name}): ${h.gate} on ${h.cleared_at}. ${h.summary}`).join("\n");
            // 2. Named imports — YAML frontmatter parse only, not full doc
            const stageConfig = state.stages[String(targetStage)];
            const imports = {};
            if (stageConfig?.imports) {
                for (const imp of stageConfig.imports) {
                    const histEntry = state.history.find((h) => h.stage === imp.stage);
                    if (!histEntry) {
                        imports[`${imp.stage}.${imp.key}`] = "MISSING — history entry not found";
                        continue;
                    }
                    const docPath = path.isAbsolute(histEntry.doc)
                        ? histEntry.doc
                        : path.join(root, histEntry.doc);
                    if (!fs.existsSync(docPath)) {
                        imports[`${imp.stage}.${imp.key}`] = `MISSING — doc not found at ${docPath}`;
                        continue;
                    }
                    const fm = parseFrontmatter(docPath);
                    imports[`s${imp.stage}.${imp.key}`] = extractExport(fm, imp.key) ?? "KEY_NOT_FOUND";
                }
            }
            // 3. SDLC section for this stage — heading-based, reuses getSdlcSection
            const sdlcContent = readSdlcContent(state.sdlc_file);
            let sdlcSection = "(no SDLC section configured for this stage)";
            if (stageConfig?.sdlc_heading) {
                try {
                    sdlcSection = getSdlcSection(sdlcContent, stageConfig.sdlc_heading);
                }
                catch {
                    sdlcSection = `(section "${stageConfig.sdlc_heading}" not found in ${state.sdlc_file})`;
                }
            }
            else {
                // Auto-discover by matching stage number prefix in headings
                const headingMatch = sdlcContent.match(new RegExp(`## (?:\\d+\\. )?Stage ${targetStage}[^\\n]*`));
                if (headingMatch) {
                    const heading = headingMatch[0].replace(/^## /, "");
                    try {
                        sdlcSection = getSdlcSection(sdlcContent, heading);
                    }
                    catch { /* leave default */ }
                }
            }
            const payload = {
                cursor: state.cursor,
                stage: targetStage,
                history_summaries: historySummaries || "(no completed stages yet)",
                imports,
                sdlc_section: sdlcSection,
                stage_config: stageConfig ?? null,
                protocol_rules: PROTOCOL_RULES,
            };
            const configNote = stageConfig
                ? `Sub-agents defined: ${stageConfig.sub_agents.map((a) => `${a.id} (${a.model})`).join(", ")}`
                : `No stage config found for Stage ${targetStage}. ` +
                    `Add a "stages.${targetStage}" entry to .sdlc-state.json with sub_agents and gate criteria, ` +
                    `then call sdlc_init again.`;
            return {
                content: [{
                        type: "text",
                        text: `sdlc_init — Stage ${targetStage} session context${lockNote}${versionNote}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `${configNote}\n\n` +
                            `Full payload (JSON):\n` +
                            JSON.stringify(payload, null, 2),
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("sdlc_agent_write", "Record a sub-agent's findings into the current stage's memory namespace. " +
        "Each sub-agent writes to its own ns key — no shared state between agents. " +
        "Call sdlc_gate_run after all agents have written.", {
        ns: z.string().describe("Namespace key matching the sub_agent ns in the stage config"),
        status: z.enum(["pass", "fail", "acknowledged"]),
        summary: z.string().describe("1–2 sentence finding summary"),
        artifacts: z.array(z.string()).describe("file:line citations supporting this finding"),
        flags: z.array(z.string()).optional().describe("Non-blocking observations to log as open items"),
        stage: z.number().int().optional().describe("Stage number. Defaults to cursor.stage."),
        project_root: z.string().optional(),
    }, async ({ ns, status, summary, artifacts, flags, stage, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const state = readState(root);
            const targetStage = stage ?? state.cursor.stage;
            const stageKey = String(targetStage);
            if (!state.stages[stageKey]) {
                return {
                    content: [{ type: "text", text: `No stage config for Stage ${targetStage}. Add stages.${stageKey} to .sdlc-state.json first.` }],
                    isError: true,
                };
            }
            const stageConfig = state.stages[stageKey];
            if (!(ns in stageConfig.memory)) {
                return {
                    content: [{ type: "text", text: `Unknown namespace "${ns}" for Stage ${targetStage}. Valid: ${Object.keys(stageConfig.memory).join(", ")}` }],
                    isError: true,
                };
            }
            const finding = {
                status,
                summary,
                artifacts,
                flags: flags ?? [],
            };
            stageConfig.memory[ns] = finding;
            writeState(root, state);
            const remaining = Object.entries(stageConfig.memory)
                .filter(([, v]) => v === null)
                .map(([k]) => k);
            return {
                content: [{
                        type: "text",
                        text: `Finding recorded: Stage ${targetStage} / ns="${ns}" / status=${status}\n` +
                            (remaining.length > 0
                                ? `Still waiting for: ${remaining.join(", ")}`
                                : `All namespaces filled. Ready to run sdlc_gate_run.`),
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("sdlc_gate_run", "Synthesize sub-agent findings and decide PASS or FAIL for the current stage gate. " +
        "On PASS: appends history entry, advances cursor, writes state atomically. " +
        "On FAIL: increments fail_count; at 2 failures adds stage to flagged[] and stops. " +
        "Conflicts between agent findings are surfaced — arbitration by Sonnet is flagged when threshold met.", {
        stage_summary: z.string().describe("2–3 sentence human-readable summary of what this stage found (goes into history)"),
        doc_path: z.string().optional().describe("Path to the sNN-findings.md written this session (relative to project_root)"),
        stage: z.number().int().optional().describe("Stage number. Defaults to cursor.stage."),
        project_root: z.string().optional(),
    }, async ({ stage_summary, doc_path, stage, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const state = readState(root);
            const targetStage = stage ?? state.cursor.stage;
            const stageKey = String(targetStage);
            if (!state.stages[stageKey]) {
                return {
                    content: [{ type: "text", text: `No stage config for Stage ${targetStage}.` }],
                    isError: true,
                };
            }
            const stageConfig = state.stages[stageKey];
            const result = runGateSynthesis(stageConfig);
            if (result.verdict === "BLOCKED") {
                return {
                    content: [{ type: "text", text: `Gate BLOCKED — ${result.reason}` }],
                    isError: true,
                };
            }
            // Human judgment escalation — does NOT consume fail_count
            if (result.verdict === "HUMAN_JUDGMENT") {
                state.cursor.status = "awaiting_review";
                writeState(root, state);
                return {
                    content: [{
                            type: "text",
                            text: `HUMAN JUDGMENT REQUIRED — Stage ${targetStage}\n` +
                                `${result.reason}\n\n` +
                                `The sub-agent flagged this stage as ambiguous. fail_count is NOT incremented.\n` +
                                `Review the findings, update the sub-agent verdict (remove requires_human_judgment), then re-run sdlc_gate_run.`,
                        }],
                    isError: true,
                };
            }
            if (result.needs_arbitration) {
                return {
                    content: [{
                            type: "text",
                            text: `Conflict arbitration needed before gate can decide.\n` +
                                `Conflicts:\n${result.conflicts?.join("\n")}\n\n` +
                                `Resolve with a Sonnet synthesis pass, then re-run sdlc_gate_run.`,
                        }],
                    isError: true,
                };
            }
            const date = new Date().toISOString().slice(0, 10);
            if (result.verdict === "PASS" || result.verdict === "CONCERNS") {
                // Collect all flags from sub-agent findings for open-item logging
                const allFlags = [];
                for (const finding of Object.values(stageConfig.memory)) {
                    if (finding)
                        allFlags.push(...finding.flags);
                }
                const gateLabel = result.verdict === "PASS" ? "PASSED" : "PASSED_WITH_CONCERNS";
                const docRel = doc_path ?? `.sdlc-sessions/s${String(targetStage).padStart(2, "0")}-findings.md`;
                const docAbsPath = path.isAbsolute(docRel) ? docRel : path.join(root, docRel);
                // Hash the findings doc at gate time — detects post-hoc edits (Defense 1)
                let docSha256 = null;
                try {
                    if (fs.existsSync(docAbsPath))
                        docSha256 = fileHash(docAbsPath);
                }
                catch { /* no doc — hash stays null */ }
                // Reviewer required? Park result, wait for sdlc_signoff
                const reviewer = stageConfig.gate.reviewer;
                if (reviewer) {
                    const pending = {
                        stage: targetStage,
                        stage_summary,
                        doc_path: docRel,
                        doc_sha256: docSha256,
                        gate_verdict: gateLabel,
                        gate_score: result.score,
                        concerns: result.concerns,
                        flags: allFlags,
                        requested_at: new Date().toISOString(),
                    };
                    state.pending_review = pending;
                    state.cursor.status = "pending_signoff";
                    state.cursor.pending_signoff = {
                        gate_verdict: gateLabel,
                        gate_score: result.score,
                        required_roles: reviewer.roles,
                        requested_at: pending.requested_at,
                    };
                    writeState(root, state);
                    const rolesNote = reviewer.roles?.length
                        ? `Required reviewer roles: ${reviewer.roles.join(", ")}`
                        : "Any reviewer may sign off.";
                    return {
                        content: [{
                                type: "text",
                                text: `GATE ${gateLabel} (score: ${result.score}/100) — Stage ${targetStage} (${stageConfig.name})\n` +
                                    `Reviewer sign-off required before cursor advances.\n` +
                                    `${rolesNote}\n\n` +
                                    `Call sdlc_signoff with approved_by to complete the gate transition.`,
                            }],
                    };
                }
                state.history.push({
                    stage: targetStage,
                    name: stageConfig.name,
                    gate: gateLabel,
                    cleared_at: date,
                    summary: stage_summary,
                    doc: docRel,
                    doc_sha256: docSha256,
                    exports: Object.keys(parseFrontmatter(docAbsPath)["exports"] ?? {}),
                    score: result.score,
                    concerns: result.concerns,
                    verified_with_framework_version: FRAMEWORK_VERSION,
                });
                // Advance cursor to next stage
                state.cursor.stage = targetStage + 1;
                state.cursor.fail_count = 0;
                state.cursor.status = "in_progress";
                state.cursor.started_at = new Date().toISOString();
                delete state.cursor.pending_signoff;
                // Reset memory for reuse
                for (const key of Object.keys(stageConfig.memory)) {
                    stageConfig.memory[key] = null;
                }
                writeState(root, state);
                // Regenerate QR table to reflect the new PASSED status (Defense 3)
                try {
                    regenerateQuickReference(state, state.sdlc_file);
                }
                catch { /* best effort */ }
                const scoreBar = "█".repeat(Math.round(result.score / 10)) + "░".repeat(10 - Math.round(result.score / 10));
                return {
                    content: [{
                            type: "text",
                            text: `GATE ${gateLabel} — Stage ${targetStage} (${stageConfig.name})\n` +
                                `Quality score: ${result.score}/100 [${scoreBar}]\n` +
                                `Cursor advanced to Stage ${targetStage + 1}.\n` +
                                (result.concerns?.length
                                    ? `\nConcerns to address (non-blocking):\n${result.concerns.map((c) => `  ⚠ ${c}`).join("\n")}`
                                    : "") +
                                (allFlags.length > 0
                                    ? `\nFlags to log as open items:\n${allFlags.map((f) => `  • ${f}`).join("\n")}`
                                    : ""),
                        }],
                };
            }
            // FAIL path
            state.cursor.fail_count += 1;
            const failCount = state.cursor.fail_count;
            if (failCount >= 2) {
                state.cursor.status = "awaiting_review";
                if (!state.flagged.includes(targetStage))
                    state.flagged.push(targetStage);
                writeState(root, state);
                return {
                    content: [{
                            type: "text",
                            text: `GATE FAILED (${failCount} failures) — Stage ${targetStage} added to flagged[] queue.\n` +
                                `Human review required. Failed criteria:\n` +
                                result.failed_criteria?.map((c) => `  • ${c}`).join("\n"),
                        }],
                    isError: true,
                };
            }
            state.cursor.status = "gate_failed";
            writeState(root, state);
            return {
                content: [{
                        type: "text",
                        text: `GATE FAILED (${failCount}/2 before human review) — Stage ${targetStage}\n` +
                            `Failed criteria:\n` +
                            result.failed_criteria?.map((c) => `  • ${c}`).join("\n") +
                            `\n\nFix the issues, re-run sub-agents, then call sdlc_gate_run again.`,
                    }],
                isError: true,
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    // ── GATE WAIVER ───────────────────────────────────────────────────────────
    server.tool("sdlc_gate_waive", "Record an explicit waiver for a gate criterion, then mark the stage WAIVED and advance the cursor. " +
        "Waivers require a documented reason and approver — they are never silent. " +
        "Only call this after the user has explicitly approved the waiver.", {
        criterion_ns: z.string().describe("The namespace key of the criterion being waived"),
        reason: z.string().describe("Why the criterion is being waived (must be substantive)"),
        approved_by: z.string().describe("Who approved this waiver (name or role)"),
        stage_summary: z.string().describe("2–3 sentence summary for the history entry"),
        doc_path: z.string().optional(),
        stage: z.number().int().optional(),
        project_root: z.string().optional(),
    }, async ({ criterion_ns, reason, approved_by, stage_summary, doc_path, stage, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const state = readState(root);
            const targetStage = stage ?? state.cursor.stage;
            const stageKey = String(targetStage);
            if (!state.stages[stageKey]) {
                return { content: [{ type: "text", text: `No stage config for Stage ${targetStage}.` }], isError: true };
            }
            const stageConfig = state.stages[stageKey];
            if (!(criterion_ns in stageConfig.memory)) {
                return { content: [{ type: "text", text: `Unknown namespace "${criterion_ns}" for Stage ${targetStage}.` }], isError: true };
            }
            const date = new Date().toISOString().slice(0, 10);
            const waiver = { stage: targetStage, criterion_ns, reason, approved_by, waived_at: date };
            state.waivers.push(waiver);
            const docRel = doc_path ?? `.sdlc-sessions/s${String(targetStage).padStart(2, "0")}-findings.md`;
            const docAbsPath = path.isAbsolute(docRel) ? docRel : path.join(root, docRel);
            // Hash findings doc at waiver time (Defense 1)
            let docSha256 = null;
            try {
                if (fs.existsSync(docAbsPath))
                    docSha256 = fileHash(docAbsPath);
            }
            catch { /* no doc */ }
            state.history.push({
                stage: targetStage,
                name: stageConfig.name,
                gate: "WAIVED",
                cleared_at: date,
                summary: stage_summary,
                doc: docRel,
                doc_sha256: docSha256,
                exports: Object.keys(parseFrontmatter(docAbsPath)["exports"] ?? {}),
                score: 0,
                concerns: [`Waived: ${criterion_ns} — ${reason}`],
                verified_with_framework_version: FRAMEWORK_VERSION,
            });
            state.cursor.stage = targetStage + 1;
            state.cursor.fail_count = 0;
            state.cursor.status = "in_progress";
            state.cursor.started_at = new Date().toISOString();
            for (const key of Object.keys(stageConfig.memory))
                stageConfig.memory[key] = null;
            writeState(root, state);
            // Regenerate QR table (Defense 3)
            try {
                regenerateQuickReference(state, state.sdlc_file);
            }
            catch { /* best effort */ }
            return {
                content: [{
                        type: "text",
                        text: `GATE WAIVED — Stage ${targetStage} (${stageConfig.name})\n` +
                            `Criterion: ${criterion_ns}\n` +
                            `Reason: ${reason}\n` +
                            `Approved by: ${approved_by}\n` +
                            `Cursor advanced to Stage ${targetStage + 1}.\n` +
                            `⚠ Waivers are carried in history — review before the next audit cycle.`,
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    // ── LOCK MANAGEMENT ───────────────────────────────────────────────────────
    server.tool("sdlc_release_lock", "Release the session lock acquired by sdlc_init. " +
        "Call at end of session or if sdlc_init refuses due to a stale lock you own. " +
        "Does nothing if no lock file exists.", { project_root: z.string().optional() }, async ({ project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const released = releaseLock(root);
            return {
                content: [{
                        type: "text",
                        text: released
                            ? `Lock released — .sdlc-state.lock removed from ${root}.`
                            : `No lock file found at ${root} — nothing to release.`,
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    // ── SIGNOFF ───────────────────────────────────────────────────────────────
    server.tool("sdlc_signoff", "Complete a gate transition that requires human reviewer sign-off. " +
        "Only callable when cursor.status = 'pending_signoff'. " +
        "Records the approver, writes the history entry, advances the cursor.", {
        approved_by: z.string().describe("Name or role of the reviewer signing off"),
        stage: z.number().int().optional().describe("Stage number. Defaults to cursor.stage."),
        project_root: z.string().optional(),
    }, async ({ approved_by, stage, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const state = readState(root);
            const targetStage = stage ?? state.cursor.stage;
            if (state.cursor.status !== "pending_signoff") {
                return {
                    content: [{ type: "text", text: `Stage ${targetStage} is not pending signoff (status: ${state.cursor.status}).` }],
                    isError: true,
                };
            }
            const pending = state.pending_review;
            if (!pending || pending.stage !== targetStage) {
                return {
                    content: [{ type: "text", text: `No pending review found for Stage ${targetStage}. State may be inconsistent.` }],
                    isError: true,
                };
            }
            const stageConfig = state.stages[String(targetStage)];
            const docAbsPath = path.isAbsolute(pending.doc_path)
                ? pending.doc_path
                : path.join(root, pending.doc_path);
            state.history.push({
                stage: targetStage,
                name: stageConfig?.name ?? `Stage ${targetStage}`,
                gate: pending.gate_verdict,
                cleared_at: new Date().toISOString(),
                summary: `${pending.stage_summary} [Signed off by: ${approved_by}]`,
                doc: pending.doc_path,
                doc_sha256: pending.doc_sha256,
                exports: Object.keys(parseFrontmatter(docAbsPath)["exports"] ?? {}),
                score: pending.gate_score,
                concerns: pending.concerns,
                verified_with_framework_version: FRAMEWORK_VERSION,
            });
            state.cursor.stage = targetStage + 1;
            state.cursor.fail_count = 0;
            state.cursor.status = "in_progress";
            state.cursor.started_at = new Date().toISOString();
            delete state.cursor.pending_signoff;
            delete state.pending_review;
            if (stageConfig) {
                for (const key of Object.keys(stageConfig.memory))
                    stageConfig.memory[key] = null;
            }
            writeState(root, state);
            try {
                regenerateQuickReference(state, state.sdlc_file);
            }
            catch { /* best effort */ }
            const scoreBar = "█".repeat(Math.round(pending.gate_score / 10)) + "░".repeat(10 - Math.round(pending.gate_score / 10));
            return {
                content: [{
                        type: "text",
                        text: `GATE ${pending.gate_verdict} — Stage ${targetStage} signed off by ${approved_by}\n` +
                            `Quality score: ${pending.gate_score}/100 [${scoreBar}]\n` +
                            `Cursor advanced to Stage ${targetStage + 1}.` +
                            (pending.flags.length > 0
                                ? `\nFlags to log as open items:\n${pending.flags.map((f) => `  • ${f}`).join("\n")}`
                                : ""),
                    }],
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    // ── DIAGNOSTICS ───────────────────────────────────────────────────────────
    server.tool("sdlc_doctor", "Diagnose the health of the SDLC state: framework version match, integrity status, " +
        "evidence staleness, and pending issues. Run at session start when something seems wrong.", { project_root: z.string().optional() }, async ({ project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const lines = ["── SDLC Doctor ──────────────────────────────────────────\n"];
            // 1. State file existence
            const statePath = path.join(root, ".sdlc-state.json");
            if (!fs.existsSync(statePath)) {
                lines.push("✗ .sdlc-state.json not found — run sdlc_state_create first.");
                return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
            }
            // 2. Integrity check (raw parse, not readState, to avoid throwing)
            let state;
            let integrityOk = true;
            try {
                state = JSON.parse(fs.readFileSync(statePath, "utf-8"));
                const { verifyState: verify } = await import("./integrity.js");
                const result = verify(state, root);
                if (!result.ok) {
                    integrityOk = false;
                    lines.push(`✗ INTEGRITY FAILURE:\n${result.errors.map((e) => `    ${e}`).join("\n")}`);
                }
                else {
                    lines.push("✓ Integrity: HMAC chain valid");
                    if (result.warnings.length > 0) {
                        lines.push(`  Warnings:\n${result.warnings.map((w) => `    ⚠ ${w}`).join("\n")}`);
                    }
                }
            }
            catch {
                lines.push("✗ Failed to parse .sdlc-state.json — file may be corrupt.");
                return { content: [{ type: "text", text: lines.join("\n") }], isError: true };
            }
            // 3. Framework version
            const stateVersion = state.sdlc_framework_version ?? "1.0.0";
            if (stateVersion === FRAMEWORK_VERSION) {
                lines.push(`✓ Framework version: ${FRAMEWORK_VERSION} (matches)`);
            }
            else {
                lines.push(`⚠ Framework version mismatch: state=v${stateVersion}, installed=v${FRAMEWORK_VERSION}`);
                lines.push(`  Run migration or update sdlc_framework_version in state after reviewing changelog.`);
            }
            // 4. Evidence staleness — check doc_sha256 for each history entry
            if (integrityOk) {
                const staleEntries = [];
                for (const entry of (state.history ?? [])) {
                    if (entry.doc_sha256 && entry.doc) {
                        const docAbs = path.isAbsolute(entry.doc) ? entry.doc : path.join(root, entry.doc);
                        if (fs.existsSync(docAbs)) {
                            const { fileHash: hash } = await import("./integrity.js");
                            const onDisk = hash(docAbs);
                            if (onDisk !== entry.doc_sha256) {
                                staleEntries.push(`Stage ${entry.stage} (${entry.name}): ${entry.doc}`);
                            }
                        }
                    }
                }
                if (staleEntries.length > 0) {
                    lines.push(`⚠ STALE EVIDENCE — findings docs modified after gate:\n${staleEntries.map((e) => `    ${e}`).join("\n")}`);
                }
                else {
                    lines.push(`✓ Evidence: all findings docs match recorded hashes`);
                }
            }
            // 5. Cursor state
            if (state.cursor) {
                const c = state.cursor;
                lines.push(`✓ Cursor: Stage ${c.stage} / ${c.status} / fail_count=${c.fail_count}`);
                if (c.status === "pending_signoff") {
                    lines.push(`  Pending signoff: ${c.pending_signoff?.gate_verdict} (since ${c.pending_signoff?.requested_at})`);
                }
            }
            // 6. Lock file
            const lockFile = path.join(root, ".sdlc-state.lock");
            if (fs.existsSync(lockFile)) {
                try {
                    const lock = JSON.parse(fs.readFileSync(lockFile, "utf-8"));
                    lines.push(`⚠ Lock file present: session ${lock.session_id}, PID ${lock.pid} on ${lock.host}, started ${lock.started_at}`);
                }
                catch {
                    lines.push("⚠ Lock file present but unreadable — consider deleting .sdlc-state.lock");
                }
            }
            else {
                lines.push("✓ No lock file (session not started)");
            }
            return { content: [{ type: "text", text: lines.join("\n") }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    // ── PRODUCTION CODING TOOLS ───────────────────────────────────────────────
    server.tool("sdlc_task_checkpoint", "Flush writer state to .sdlc-tasks/{task_id}.json after each iteration and return a compact " +
        "reload payload for the next iteration. Keeps writer context flat regardless of iteration count. " +
        "The conversation history of prior iterations is disposable — the task file holds the ground truth.", {
        task_id: z.string().describe("Unique slug for this writing task, e.g. 'orders-create-handler'"),
        file_path: z.string().describe("Absolute or project-relative path to the file being written"),
        status: z.enum(["in_progress", "blocked", "complete"]),
        changes_made: z.string().describe("What was changed or attempted in this iteration"),
        next_action: z.string().describe("Exactly what the next iteration must do (carried forward on reload)"),
        current_error: z.string().optional().describe("Raw error if status=blocked — will be diagnosed before storage"),
        error_lines: z.array(z.string()).optional().describe("Specific file:line citations for the error"),
        stage: z.number().int().optional().describe("SDLC stage this task belongs to. Defaults to cursor.stage."),
        project_root: z.string().optional(),
    }, async ({ task_id, file_path, status, changes_made, next_action, current_error, error_lines, stage, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            // Resolve stage from state if not provided
            let resolvedStage = stage;
            if (resolvedStage === undefined) {
                try {
                    resolvedStage = readState(root).cursor.stage;
                }
                catch {
                    resolvedStage = 0;
                }
            }
            // Load or initialise the task checkpoint
            const now = new Date().toISOString();
            const existing = readTask(root, task_id);
            const iteration = {
                n: existing ? existing.current_iteration + 1 : 1,
                status,
                changes: changes_made,
                next_action,
                timestamp: now,
                ...(current_error ? { error: current_error } : {}),
                ...(error_lines?.length ? { error_lines } : {}),
            };
            const task = existing
                ? {
                    ...existing,
                    iterations: [...existing.iterations, iteration],
                    current_iteration: iteration.n,
                    status: status === "complete" ? "complete"
                        : existing.fail_count + (status === "blocked" ? 1 : 0) >= 2 ? "flagged"
                            : status,
                    fail_count: existing.fail_count + (status === "blocked" ? 1 : 0),
                    updated_at: now,
                }
                : {
                    task_id,
                    file: file_path,
                    stage: resolvedStage,
                    iterations: [iteration],
                    current_iteration: 1,
                    status,
                    fail_count: status === "blocked" ? 1 : 0,
                    started_at: now,
                    updated_at: now,
                };
            writeTask(root, task);
            // Build compact reload payload — only what the next iteration needs
            const reloadPayload = {
                task_id,
                file: file_path,
                iteration: iteration.n,
                status: task.status,
                next_action,
                ...(current_error ? { current_error } : {}),
                ...(error_lines?.length ? { error_lines } : {}),
                fail_count: task.fail_count,
            };
            const statusLine = task.status === "flagged"
                ? `FLAGGED after ${task.fail_count} blocked iterations — human review required.`
                : task.status === "complete"
                    ? `Complete. Task archived at ${taskDir(root)}/${task_id}.json`
                    : `Iteration ${iteration.n} checkpointed. Reload payload below — discard prior conversation history.`;
            return {
                content: [{
                        type: "text",
                        text: `sdlc_task_checkpoint — ${task_id} / iteration ${iteration.n}\n` +
                            `${statusLine}\n\n` +
                            `Reload payload (attach this to the next iteration, nothing else):\n` +
                            JSON.stringify(reloadPayload, null, 2),
                    }],
                isError: task.status === "flagged",
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    server.tool("sdlc_error_diagnose", "Classify raw compiler/linter/test output into a structured error payload. " +
        "Returns only the relevant lines (never the full output) so the writer agent " +
        "never accumulates full compiler traces in its context. " +
        "Recognises TypeScript errors, ESLint violations, Jest failures, import errors, syntax errors.", {
        error_output: z.string().describe("Raw output from tsc, eslint, jest, or any build tool"),
        file_path: z.string().describe("The file being worked on — used to anchor file references"),
        task_id: z.string().optional().describe("Associate diagnosis with a task checkpoint"),
        project_root: z.string().optional(),
    }, async ({ error_output, file_path, task_id, project_root }) => {
        try {
            const root = resolveProjectRoot(project_root);
            const errors = diagnoseError(error_output, file_path);
            // If task_id given and task exists, append the diagnosis to its latest iteration
            if (task_id) {
                const task = readTask(root, task_id);
                if (task && task.iterations.length > 0) {
                    const last = task.iterations[task.iterations.length - 1];
                    last.error = errors.map((e) => e.message).join(" | ");
                    last.error_lines = errors.flatMap((e) => e.line ? [`${e.file}:${e.line}`] : []);
                    writeTask(root, task);
                }
            }
            const errorCount = errors.filter((e) => e.severity === "error").length;
            const warnCount = errors.filter((e) => e.severity === "warning").length;
            const formatted = errors
                .map((e, i) => [
                `[${i + 1}] ${e.kind.toUpperCase()} — ${e.severity}`,
                `    File: ${e.file}${e.line ? `:${e.line}` : ""}${e.col ? `:${e.col}` : ""}`,
                `    Message: ${e.message}`,
                `    Excerpt:\n${e.raw_excerpt.split("\n").map((l) => `      ${l}`).join("\n")}`,
                e.fix_hint ? `    Fix hint: ${e.fix_hint}` : "",
            ]
                .filter(Boolean)
                .join("\n"))
                .join("\n\n");
            return {
                content: [{
                        type: "text",
                        text: `sdlc_error_diagnose — ${errorCount} error(s), ${warnCount} warning(s)\n` +
                            `File: ${file_path}\n` +
                            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                            formatted +
                            `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                            `Pass these ${errors.length} diagnosed error(s) to the writer. ` +
                            `Do NOT pass the raw compiler output — only this payload.`,
                    }],
                isError: errorCount > 0,
            };
        }
        catch (err) {
            return { content: [{ type: "text", text: String(err) }], isError: true };
        }
    });
    // ── RESOURCES ──────────────────────────────────────────────────────────────
    server.resource("sdlc-validation", "sdlc://validation", { description: "Full SDLC_VALIDATION.md for the current project", mimeType: "text/markdown" }, async (uri) => {
        const root = resolveProjectRoot();
        const sdlcPath = findSdlcFile(root);
        return {
            contents: [{ uri: uri.href, text: readSdlcContent(sdlcPath), mimeType: "text/markdown" }],
        };
    });
    server.resource("sdlc-gates", "sdlc://gates", { description: "Current gate status summary table", mimeType: "text/plain" }, async (uri) => {
        const root = resolveProjectRoot();
        const sdlcPath = findSdlcFile(root);
        const statuses = getGateStatuses(readSdlcContent(sdlcPath));
        const table = `| Stage | Name | Status | Passed Date |\n|---|---|---|---|\n` +
            statuses
                .map((s) => `| ${s.stage} | ${s.name} | \`${s.status}\` | ${s.passedDate ?? ""} |`)
                .join("\n");
        return { contents: [{ uri: uri.href, text: table, mimeType: "text/plain" }] };
    });
    // ── PROMPTS ────────────────────────────────────────────────────────────────
    server.prompt("sdlc_protocol", "SDLC Section 0 protocol rules. Include in your system prompt to activate gate enforcement.", {}, async () => ({
        messages: [
            { role: "user", content: { type: "text", text: PROTOCOL_RULES } },
        ],
    }));
    server.prompt("sdlc_session_start", "Full session-startup checklist: loads protocol rules + current gate status in one prompt.", { project_root: z.string().optional().describe("Absolute path to project root") }, async ({ project_root }) => {
        const root = resolveProjectRoot(project_root);
        let gateTable = "Could not read gate statuses.";
        let sdlcPath = "(not found)";
        try {
            sdlcPath = findSdlcFile(root);
            const statuses = getGateStatuses(readSdlcContent(sdlcPath));
            gateTable = statuses.map((s) => `Stage ${s.stage} (${s.name}): ${s.status}`).join("\n");
        }
        catch {
            // leave defaults
        }
        const text = `${PROTOCOL_RULES}\n\n---\n\n` +
            `## Current Gate Status (${sdlcPath})\n\n${gateTable}\n\n` +
            `---\n\n## Startup instructions\n` +
            `1. Call get_project_identity to fill Section 1 placeholders — present the table to the user.\n` +
            `2. Report the gate statuses above.\n` +
            `3. Ask the user what they want to work on.\n` +
            `4. Before writing any code, call check_gate_status for the relevant stage.`;
        return {
            messages: [{ role: "user", content: { type: "text", text } }],
        };
    });
    return server;
}
//# sourceMappingURL=server.js.map