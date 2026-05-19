import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  resolveProjectRoot,
  findSdlcFile,
  readSdlcContent,
  getGateStatuses,
  getSdlcSection,
  appendTableRow,
  artifactInfo,
} from "./sdlc.js";

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

export function createServer(): McpServer {
  const server = new McpServer({ name: "sdlc-validation", version: "1.0.0" });

  // ── TOOLS ──────────────────────────────────────────────────────────────────

  server.tool(
    "check_gate_status",
    "Check whether an SDLC stage gate is PASSED. Always call before writing code for a stage. " +
      "Returns isError:true when the gate is not yet passed so Claude stops and reports to the user.",
    {
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
    },
    async ({ stage, project_root }) => {
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
        const summary =
          blocked.length > 0
            ? `\n⚠ ${blocked.length} gate(s) not yet PASSED: ${blocked.map((s) => `Stage ${s.stage}`).join(", ")}`
            : `\n✓ All named-stage gates are PASSED or ONGOING.`;

        return {
          content: [
            {
              type: "text",
              text:
                `SDLC Gate Status — ${sdlcPath}\n\n` +
                `| Stage | Name | Status | Passed |\n|---|---|---|---|\n${rows}` +
                summary,
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "get_project_identity",
    "Read Section 1 (Project Identity) from the SDLC file. Call this at session start to fill placeholders.",
    {
      project_root: z.string().optional(),
    },
    async ({ project_root }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const sdlcPath = findSdlcFile(root);
        const section = getSdlcSection(readSdlcContent(sdlcPath), "1. Project Identity");
        return { content: [{ type: "text", text: `Source: ${sdlcPath}\n\n${section}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "read_sdlc_section",
    "Read a specific section of SDLC_VALIDATION.md by its heading number and title.",
    {
      heading: z
        .string()
        .describe(
          "The heading text after '## ', e.g. '2. Stage 1 — Inception & Requirements' or '15. Decision Log'"
        ),
      project_root: z.string().optional(),
    },
    async ({ heading, project_root }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const sdlcPath = findSdlcFile(root);
        const section = getSdlcSection(readSdlcContent(sdlcPath), heading);
        return { content: [{ type: "text", text: section }] };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "log_decision",
    "Append a row to Section 15 (Decision Log). Must be called before acting on any significant decision.",
    {
      stage: z.number().int().describe("Stage number this decision belongs to"),
      decision: z.string().describe("The decision made"),
      rationale: z.string().describe("Why this decision was made"),
      alternatives: z.string().optional().describe("Alternatives that were considered (use '—' if none)"),
      approved_by: z.string().optional().describe("Who approved the decision"),
      project_root: z.string().optional(),
    },
    async ({ stage, decision, rationale, alternatives, approved_by, project_root }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const sdlcPath = findSdlcFile(root);
        const date = new Date().toISOString().slice(0, 10);
        const row = `| ${date} | ${stage} | ${decision} | ${rationale} | ${alternatives ?? "—"} | ${approved_by ?? "pending"} |`;
        const { lineNumber } = appendTableRow(sdlcPath, "15. Decision Log", row);
        return {
          content: [{ type: "text", text: `Decision logged at ${sdlcPath}:${lineNumber}` }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "log_open_item",
    "Append an out-of-scope issue to Section 16 (Open Items). Use instead of silently fixing unrelated issues.",
    {
      description: z.string().describe("Description of the issue"),
      priority: z.enum(["high", "medium", "low"]),
      stage: z.number().int().optional().describe("Stage where the issue was found"),
      assigned_to: z.string().optional(),
      project_root: z.string().optional(),
    },
    async ({ description, priority, stage, assigned_to, project_root }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const sdlcPath = findSdlcFile(root);
        const date = new Date().toISOString().slice(0, 10);
        const row = `| ${date} | ${stage ?? "—"} | ${description} | ${priority} | ${assigned_to ?? "—"} |`;
        const { lineNumber } = appendTableRow(sdlcPath, "16. Open Items", row);
        return {
          content: [{ type: "text", text: `Open item logged at ${sdlcPath}:${lineNumber}` }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "update_session_log",
    "Append a one-line entry to Section 18 (Session Log). Call before ending every session.",
    {
      work_done: z.string().describe("What was accomplished this session"),
      gates_changed: z
        .string()
        .optional()
        .describe("Which gate statuses changed this session, or 'none'"),
      next_step: z.string().describe("What the next session should start with"),
      project_root: z.string().optional(),
    },
    async ({ work_done, gates_changed, next_step, project_root }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const sdlcPath = findSdlcFile(root);
        const date = new Date().toISOString().slice(0, 10);
        const row = `| ${date} | ${work_done} | ${gates_changed ?? "none"} | ${next_step} |`;
        const { lineNumber } = appendTableRow(sdlcPath, "18. Session Log", row);
        return {
          content: [{ type: "text", text: `Session log updated at ${sdlcPath}:${lineNumber}` }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );

  server.tool(
    "verify_artifact",
    "Check whether a required SDLC artifact file or directory exists. Returns a file:line citation for gate evidence.",
    {
      artifact_path: z
        .string()
        .describe("Path relative to project_root, or absolute. e.g. 'docs/spec.md' or 'src/'"),
      project_root: z.string().optional(),
    },
    async ({ artifact_path, project_root }) => {
      try {
        const root = resolveProjectRoot(project_root);
        const info = artifactInfo(artifact_path, root);
        if (!info.exists) {
          return {
            content: [
              {
                type: "text",
                text:
                  `ARTIFACT MISSING: ${info.fullPath}\n` +
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
      } catch (err) {
        return { content: [{ type: "text", text: String(err) }], isError: true };
      }
    }
  );

  // ── RESOURCES ──────────────────────────────────────────────────────────────

  server.resource(
    "sdlc-validation",
    "sdlc://validation",
    { description: "Full SDLC_VALIDATION.md for the current project", mimeType: "text/markdown" },
    async (uri) => {
      const root = resolveProjectRoot();
      const sdlcPath = findSdlcFile(root);
      return {
        contents: [{ uri: uri.href, text: readSdlcContent(sdlcPath), mimeType: "text/markdown" }],
      };
    }
  );

  server.resource(
    "sdlc-gates",
    "sdlc://gates",
    { description: "Current gate status summary table", mimeType: "text/plain" },
    async (uri) => {
      const root = resolveProjectRoot();
      const sdlcPath = findSdlcFile(root);
      const statuses = getGateStatuses(readSdlcContent(sdlcPath));
      const table =
        `| Stage | Name | Status | Passed Date |\n|---|---|---|---|\n` +
        statuses
          .map((s) => `| ${s.stage} | ${s.name} | \`${s.status}\` | ${s.passedDate ?? ""} |`)
          .join("\n");
      return { contents: [{ uri: uri.href, text: table, mimeType: "text/plain" }] };
    }
  );

  // ── PROMPTS ────────────────────────────────────────────────────────────────

  server.prompt(
    "sdlc_protocol",
    "SDLC Section 0 protocol rules. Include in your system prompt to activate gate enforcement.",
    {},
    async () => ({
      messages: [
        { role: "user" as const, content: { type: "text" as const, text: PROTOCOL_RULES } },
      ],
    })
  );

  server.prompt(
    "sdlc_session_start",
    "Full session-startup checklist: loads protocol rules + current gate status in one prompt.",
    { project_root: z.string().optional().describe("Absolute path to project root") },
    async ({ project_root }) => {
      const root = resolveProjectRoot(project_root);
      let gateTable = "Could not read gate statuses.";
      let sdlcPath = "(not found)";
      try {
        sdlcPath = findSdlcFile(root);
        const statuses = getGateStatuses(readSdlcContent(sdlcPath));
        gateTable = statuses.map((s) => `Stage ${s.stage} (${s.name}): ${s.status}`).join("\n");
      } catch {
        // leave defaults
      }

      const text =
        `${PROTOCOL_RULES}\n\n---\n\n` +
        `## Current Gate Status (${sdlcPath})\n\n${gateTable}\n\n` +
        `---\n\n## Startup instructions\n` +
        `1. Call get_project_identity to fill Section 1 placeholders — present the table to the user.\n` +
        `2. Report the gate statuses above.\n` +
        `3. Ask the user what they want to work on.\n` +
        `4. Before writing any code, call check_gate_status for the relevant stage.`;

      return {
        messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
      };
    }
  );

  return server;
}
