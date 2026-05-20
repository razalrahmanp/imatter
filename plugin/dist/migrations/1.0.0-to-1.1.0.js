// Migration: 1.0.0 → 1.1.0
//
// What this does:
//   - Injects region markers into documents that have no markers yet (bootstrapping)
//   - Documents that already have markers are passed through unchanged
//   - The generated output matches the canonical template for v1.1.0
import { generateTaggedTemplate } from "../template-generator.js";
import { parseRegions } from "../regions.js";
export const migration = {
    from: "1.0.x",
    to: "1.1.0",
    description: "Inject region markers into SDLC_VALIDATION.md (bootstrapping existing documents)",
    apply(ctx) {
        const changes = [];
        const warnings = [];
        // If the document is already fully tagged, nothing to do
        if (ctx.parsed.isFullyTagged) {
            return {
                newContent: ctx.lines.join("\n"),
                changes: [],
                warnings: ["Document already has region markers — no changes made."],
            };
        }
        // The document has untagged content — generate a tagged version
        const { tagged, unknownSections } = generateTaggedTemplate(ctx.lines.join("\n"), ctx.toVersion);
        changes.push(`Injected region markers for ${ctx.parsed.regions.length === 0 ? "all sections" : "untagged sections"}`);
        if (unknownSections.length > 0) {
            warnings.push(`${unknownSections.length} section(s) were not recognized and were left untagged:\n` +
                unknownSections.map((s) => `  - ## ${s}`).join("\n") + "\n" +
                "These are likely custom sections — add them to SECTION_MAP if they should be tracked.");
        }
        // Detect user content that was inside framework regions and warn
        const reParsed = parseRegions(tagged);
        const dirtyCount = reParsed.regions.filter((r) => r.type === "framework" && r.dirty).length;
        if (dirtyCount > 0) {
            warnings.push(`${dirtyCount} framework region(s) have content that differs from the v1.1.0 canonical template. ` +
                `This usually means the document was edited before region markers were introduced. ` +
                `Run 'sdlc upgrade --check' after this migration to review each one.`);
        }
        changes.push(`Added <!-- SDLC:version "${ctx.toVersion}" --> marker`);
        return { newContent: tagged, changes, warnings };
    },
};
//# sourceMappingURL=1.0.0-to-1.1.0.js.map