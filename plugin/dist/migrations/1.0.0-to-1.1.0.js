// Migration: 1.0.0 → 1.1.0
//
// Adds the SDLC:version marker to the document preamble.
// After this migration, run `sdlc-tag --force` to apply full region markers.
export const migration = {
    from: "1.0.0",
    to: "1.1.0",
    description: "Add SDLC:version marker to document preamble",
    apply(ctx) {
        const changes = [];
        const warnings = [];
        const lines = [...ctx.lines];
        if (lines.some((l) => l.includes("SDLC:version"))) {
            warnings.push("SDLC:version marker already present — skipping.");
            return { newContent: lines.join("\n"), changes, warnings };
        }
        // Insert after the first H1 title line
        const versionMarker = `<!-- SDLC:version "1.1.0" -->`;
        let insertAt = 1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith("# ")) {
                insertAt = i + 1;
                break;
            }
        }
        lines.splice(insertAt, 0, versionMarker);
        changes.push(`Inserted ${versionMarker} at line ${insertAt + 1}`);
        changes.push(`Run \`sdlc-tag --force\` next to apply full region markers`);
        return { newContent: lines.join("\n"), changes, warnings };
    },
};
//# sourceMappingURL=1.0.0-to-1.1.0.js.map