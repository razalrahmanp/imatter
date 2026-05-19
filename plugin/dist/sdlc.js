import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
export function resolveProjectRoot(override) {
    return resolve(override ?? process.env.SDLC_PROJECT_ROOT ?? process.cwd());
}
export function findSdlcFile(projectRoot) {
    const direct = join(projectRoot, "SDLC_VALIDATION.md");
    if (existsSync(direct))
        return direct;
    const parent = join(dirname(projectRoot), "SDLC_VALIDATION.md");
    if (existsSync(parent))
        return parent;
    throw new Error(`SDLC_VALIDATION.md not found in "${projectRoot}" or its parent. ` +
        `Set SDLC_PROJECT_ROOT env var or pass project_root to the tool.`);
}
export function readSdlcContent(sdlcPath) {
    return readFileSync(sdlcPath, "utf-8").replace(/\r\n/g, "\n");
}
export function getGateStatuses(content) {
    // Parse the Quick Reference table at the end of the document
    const match = content.match(/## Quick Reference[^\n]*\n[\s\S]*?\|[-| :]+\|\n([\s\S]*?)(?=\n\n---|$)/);
    if (!match)
        return [];
    return match[1]
        .split("\n")
        .filter((r) => /\|\s*\d+/.test(r))
        .map((row) => {
        const cells = row
            .split("|")
            .map((c) => c.trim())
            .filter(Boolean);
        const rawStatus = cells[2]?.replace(/`/g, "").trim() ?? "NOT STARTED";
        return {
            stage: parseInt(cells[0] ?? "0"),
            name: cells[1] ?? "Unknown",
            status: rawStatus,
            passedDate: cells[3] || undefined,
        };
    });
}
export function getSdlcSection(content, heading) {
    const start = content.indexOf(`## ${heading}`);
    if (start === -1)
        throw new Error(`Section "## ${heading}" not found in SDLC file.`);
    const nextSection = content.indexOf("\n## ", start + 4);
    return nextSection === -1 ? content.slice(start) : content.slice(start, nextSection);
}
/** Append a Markdown table row to the last table in a given section. */
export function appendTableRow(sdlcPath, sectionHeading, newRow) {
    let content = readFileSync(sdlcPath, "utf-8");
    const sectionStart = content.indexOf(`## ${sectionHeading}`);
    if (sectionStart === -1)
        throw new Error(`Section "## ${sectionHeading}" not found.`);
    const sectionEnd = content.indexOf("\n## ", sectionStart + 4);
    const sectionSlice = sectionEnd === -1 ? content.slice(sectionStart) : content.slice(sectionStart, sectionEnd);
    // Find the last line in the section that looks like a table row
    const lines = sectionSlice.split("\n");
    let lastTableIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith("|")) {
            lastTableIdx = i;
            break;
        }
    }
    if (lastTableIdx === -1)
        throw new Error(`No table found in section "## ${sectionHeading}".`);
    lines.splice(lastTableIdx + 1, 0, newRow);
    const newSectionSlice = lines.join("\n");
    content =
        sectionEnd === -1
            ? content.slice(0, sectionStart) + newSectionSlice
            : content.slice(0, sectionStart) + newSectionSlice + content.slice(sectionEnd);
    writeFileSync(sdlcPath, content, "utf-8");
    // Return the 1-based line number of the inserted row
    const lineNumber = content.slice(0, content.indexOf(newRow)).split("\n").length;
    return { lineNumber };
}
export function artifactInfo(artifactPath, projectRoot) {
    const fullPath = artifactPath.match(/^([A-Za-z]:[/\\]|\/)/) ? artifactPath : join(projectRoot, artifactPath);
    if (!existsSync(fullPath))
        return { exists: false, fullPath };
    const stat = statSync(fullPath);
    if (stat.isDirectory())
        return { exists: true, fullPath, isDir: true };
    const text = readFileSync(fullPath, "utf-8");
    return { exists: true, fullPath, lineCount: text.split("\n").length };
}
//# sourceMappingURL=sdlc.js.map