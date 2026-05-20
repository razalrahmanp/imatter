import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
/**
 * Compliance module registry.
 *
 * Per-project declarations live in `.sdlc-stack.json#compliance` as an array of
 * module identifiers, e.g.:
 *
 *   {
 *     "stack": "react-supabase-lambda",
 *     "compliance": ["gdpr", "hipaa"]
 *   }
 *
 * The plugin ships compliance skills flat in `plugin/skills/sdlc-{module}-{name}.md`.
 * When a project declares a module, the framework treats the matching skills as
 * "active" — the orchestrator and `/sdlc-status` surface them; skills outside
 * declared modules are still available (Claude Code loads all marketplace skills)
 * but are flagged as out-of-scope for this project.
 */
export const KNOWN_MODULES = [
    "gdpr",
    "hipaa",
    "soc2",
    "pci-dss",
    "eu-ai-act",
    "wcag",
    "accessibility-us",
    "accessibility-eu",
];
export function readStackConfig(projectRoot) {
    const p = join(projectRoot, ".sdlc-stack.json");
    if (!existsSync(p))
        return {};
    try {
        return JSON.parse(readFileSync(p, "utf-8"));
    }
    catch {
        return {};
    }
}
/**
 * Scan the plugin's bundled skills directory for compliance-prefixed skill files.
 *
 * Convention: a compliance skill is named `sdlc-{module}-{rest}.md`.
 * E.g. `sdlc-gdpr-consent-management.md` belongs to the `gdpr` module.
 *
 * pluginSkillsDir is normally `{plugin install}/skills/` resolved via
 * `${CLAUDE_PLUGIN_ROOT}` at MCP-server startup time, or the bundled template
 * directory when running from the repo.
 */
export function listComplianceSkillsInPlugin(pluginSkillsDir) {
    if (!existsSync(pluginSkillsDir))
        return {};
    const byModule = {};
    const files = readdirSync(pluginSkillsDir).filter((f) => f.endsWith(".md"));
    for (const f of files) {
        // Match sdlc-{module}-{rest}.md against known module prefixes
        const stem = f.replace(/^sdlc-/, "").replace(/\.md$/, "");
        for (const mod of KNOWN_MODULES) {
            const prefix = `${mod}-`;
            if (stem.startsWith(prefix)) {
                const skillId = `sdlc-${stem}`;
                (byModule[mod] ??= []).push(skillId);
                break;
            }
        }
    }
    return byModule;
}
/**
 * Compute compliance status: declared modules, unknown declarations, the set of
 * shipping skills per module, and skills present in the plugin that fall under
 * undeclared modules (out of scope for this project).
 */
export function computeComplianceStatus(projectRoot, pluginSkillsDir) {
    const cfg = readStackConfig(projectRoot);
    const declared = cfg.compliance ?? [];
    const knownSet = new Set(KNOWN_MODULES);
    const declaredKnown = declared.filter((m) => knownSet.has(m));
    const unknownDeclared = declared.filter((m) => !knownSet.has(m));
    const allByModule = listComplianceSkillsInPlugin(pluginSkillsDir);
    const availableSkills = {};
    const outOfScope = [];
    const declaredSet = new Set(declaredKnown);
    for (const [mod, skills] of Object.entries(allByModule)) {
        if (declaredSet.has(mod)) {
            availableSkills[mod] = skills;
        }
        else {
            outOfScope.push(...skills);
        }
    }
    const recommendations = [];
    if (declared.length === 0) {
        recommendations.push("No compliance modules declared. Edit .sdlc-stack.json to add a 'compliance' array if any regimes apply (gdpr, hipaa, soc2, pci-dss, eu-ai-act, etc.).");
    }
    if (unknownDeclared.length > 0) {
        recommendations.push(`Declared compliance modules not recognized: ${unknownDeclared.join(", ")}. ` +
            `Known modules: ${KNOWN_MODULES.join(", ")}.`);
    }
    if (declaredKnown.some((m) => !allByModule[m])) {
        const missing = declaredKnown.filter((m) => !allByModule[m]);
        recommendations.push(`Declared module(s) without shipping skills in the plugin: ${missing.join(", ")}.`);
    }
    if (declaredKnown.length > 0 && outOfScope.length > 0) {
        recommendations.push(`${outOfScope.length} compliance skill(s) present in plugin but outside declared modules. ` +
            `Claude may still invoke them if context matches; flag in code review if a non-declared regime appears in PRs.`);
    }
    return {
        declared,
        unknown_declared: unknownDeclared,
        available_skills: availableSkills,
        out_of_scope_skills: outOfScope.sort(),
        recommendations,
    };
}
export function formatComplianceStatus(s) {
    const lines = [];
    lines.push(`Declared modules: ${s.declared.length === 0 ? "(none)" : s.declared.join(", ")}`);
    if (s.unknown_declared.length > 0) {
        lines.push(`Unknown declarations: ${s.unknown_declared.join(", ")}`);
    }
    lines.push("");
    lines.push("Active compliance skills (declared modules only):");
    if (Object.keys(s.available_skills).length === 0) {
        lines.push("  (none)");
    }
    else {
        for (const [mod, skills] of Object.entries(s.available_skills)) {
            lines.push(`  ${mod}: ${skills.length} skill(s)`);
            for (const id of skills) {
                lines.push(`    - ${id}`);
            }
        }
    }
    if (s.out_of_scope_skills.length > 0) {
        lines.push("");
        lines.push(`Out-of-scope compliance skills present in plugin (${s.out_of_scope_skills.length}):`);
        lines.push("  " + s.out_of_scope_skills.slice(0, 10).join(", ") +
            (s.out_of_scope_skills.length > 10 ? ", ..." : ""));
    }
    if (s.recommendations.length > 0) {
        lines.push("");
        lines.push("Recommendations:");
        for (const r of s.recommendations) {
            lines.push(`  - ${r}`);
        }
    }
    return lines.join("\n");
}
//# sourceMappingURL=compliance.js.map