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
export declare const KNOWN_MODULES: readonly ["gdpr", "hipaa", "soc2", "pci-dss", "eu-ai-act", "wcag", "accessibility-us", "accessibility-eu"];
export type ComplianceModule = (typeof KNOWN_MODULES)[number];
export interface StackConfig {
    stack?: string;
    project_overlay?: string;
    compliance?: string[];
}
export interface ComplianceStatus {
    declared: string[];
    unknown_declared: string[];
    available_skills: Record<string, string[]>;
    out_of_scope_skills: string[];
    recommendations: string[];
}
export declare function readStackConfig(projectRoot: string): StackConfig;
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
export declare function listComplianceSkillsInPlugin(pluginSkillsDir: string): Record<string, string[]>;
/**
 * Compute compliance status: declared modules, unknown declarations, the set of
 * shipping skills per module, and skills present in the plugin that fall under
 * undeclared modules (out of scope for this project).
 */
export declare function computeComplianceStatus(projectRoot: string, pluginSkillsDir: string): ComplianceStatus;
export declare function formatComplianceStatus(s: ComplianceStatus): string;
