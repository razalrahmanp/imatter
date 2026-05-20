import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadKey, computeEntryHmac, computeCursorHmac, computeTopLevelHmac, fileHash, } from "./integrity.js";
export function buildHistoryVerifyReport(projectRoot) {
    const statePath = join(projectRoot, ".sdlc-state.json");
    if (!existsSync(statePath)) {
        throw new Error(`No .sdlc-state.json found at ${statePath}`);
    }
    const raw = JSON.parse(readFileSync(statePath, "utf-8"));
    const key = loadKey(projectRoot);
    const keyPresent = key !== null;
    const errors = [];
    const warnings = [];
    // Top-level signature
    let topLevel = "unsigned";
    if (key) {
        const sig = raw._signature?.value;
        if (sig) {
            topLevel = computeTopLevelHmac(raw, key) === sig ? "valid" : "invalid";
            if (topLevel === "invalid")
                errors.push("Top-level HMAC mismatch — state file may have been edited outside the tool.");
        }
        else {
            warnings.push("No top-level signature — state pre-dates integrity protection.");
        }
    }
    // Cursor HMAC
    let cursor = "unsigned";
    if (key) {
        const c = raw.cursor;
        if (c?.hmac) {
            cursor = computeCursorHmac(c, key) === c.hmac ? "valid" : "invalid";
            if (cursor === "invalid")
                errors.push("Cursor HMAC mismatch — cursor may have been edited.");
        }
    }
    const history = raw.history ?? [];
    const entries = history.map((entry) => {
        let hmacStatus = "unsigned";
        if (key && entry.hmac) {
            const expected = computeEntryHmac(entry, key);
            hmacStatus = expected === entry.hmac ? "valid" : "invalid";
            if (hmacStatus === "invalid") {
                errors.push(`Stage ${entry.stage} (${entry.name}) history entry HMAC mismatch.`);
            }
        }
        else if (key && !entry.hmac) {
            warnings.push(`Stage ${entry.stage} (${entry.name}) entry is unsigned (pre-integrity).`);
        }
        let docHash = "not_recorded";
        if (entry.doc_sha256 && entry.doc) {
            const docAbsPath = entry.doc.startsWith("/") || /^[A-Za-z]:\\/.test(entry.doc)
                ? entry.doc
                : join(projectRoot, entry.doc);
            if (existsSync(docAbsPath)) {
                const onDisk = fileHash(docAbsPath);
                docHash = onDisk === entry.doc_sha256 ? "valid" : "invalid";
                if (docHash === "invalid") {
                    errors.push(`Stage ${entry.stage} findings doc hash mismatch — doc may have been edited: ${entry.doc}`);
                }
            }
            else {
                docHash = "not_on_disk";
                warnings.push(`Stage ${entry.stage} findings doc not found on disk: ${entry.doc}`);
            }
        }
        return {
            stage: entry.stage,
            name: entry.name,
            gate: entry.gate,
            cleared_at: entry.cleared_at,
            score: entry.score ?? 0,
            hmac: hmacStatus,
            docHash,
        };
    });
    return {
        ok: errors.length === 0,
        keyPresent,
        topLevel,
        cursor,
        entries,
        errors,
        warnings,
    };
}
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function extractStageNumber(heading) {
    const m = heading.match(/Stage\s+(\d+)/i);
    if (m)
        return parseInt(m[1], 10);
    return null;
}
export function traceRequirementsInDoc(content, reqId, caseSensitive, gateStatuses) {
    const lines = content.split("\n");
    const flags = caseSensitive ? "g" : "gi";
    const pattern = new RegExp(escapeRegex(reqId), flags);
    // Split content into ## sections
    // Content before the first ## heading (preamble) is intentionally excluded from search.
    const sections = [];
    let current = null;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("## ")) {
            if (current)
                sections.push(current);
            current = { heading: lines[i].slice(3).trim(), startLine: i, lines: [] };
        }
        else if (current) {
            current.lines.push(lines[i]);
        }
    }
    if (current)
        sections.push(current);
    const result = [];
    for (const section of sections) {
        const hits = [];
        for (let j = 0; j < section.lines.length; j++) {
            pattern.lastIndex = 0;
            if (pattern.test(section.lines[j])) {
                hits.push({
                    line: section.startLine + j + 2,
                    text: section.lines[j].trim(),
                });
            }
        }
        if (hits.length === 0)
            continue;
        const stageNumber = extractStageNumber(section.heading);
        const gateStatus = stageNumber !== null
            ? (gateStatuses.find((g) => g.stage === stageNumber)?.status ?? null)
            : null;
        result.push({ sectionHeading: section.heading, stageNumber, gateStatus, hits });
    }
    return result;
}
//# sourceMappingURL=audit.js.map