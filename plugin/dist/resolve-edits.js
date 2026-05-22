// Interactive resolution for unauthorised framework-region edits.
//
// When a client has edited content inside a framework region, the migration
// pauses and asks them what to do for each edit:
//
//   [o]verride — wrap the edit as a user-override block (your edit wins for
//                this project; framework canonical is preserved underneath)
//   [d]iscard  — revert to the framework canonical content
//   [s]kip     — leave the edit in place untagged (continues to warn on every
//                check; useful when you want to defer the decision)
//
// In non-TTY environments (CI, scripts) the prompt is replaced by --auto-resolve.
import * as readline from "node:readline";
import { parseRegions, serializeRegions, hashContent } from "./regions.js";
import { deserializeRegistry } from "./template-generator.js";
import { readFileSync } from "node:fs";
// ── Detection ─────────────────────────────────────────────────────────────────
export function detectEdits(sdlcContent, registry) {
    const parsed = parseRegions(sdlcContent);
    const edits = [];
    for (const r of parsed.regions) {
        if (r.type !== "framework" || !r.dirty || !r.hash)
            continue;
        edits.push({
            regionId: r.id,
            startLine: r.startLine,
            recordedHash: r.hash,
            currentHash: hashContent(r.content),
            currentContent: r.content,
            canonicalContent: registry?.get(r.id)?.content,
        });
    }
    return edits;
}
// ── Interactive prompt ────────────────────────────────────────────────────────
async function promptOne(edit, total, index) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise((resolve) => rl.question(q, resolve));
    process.stdout.write(`\n[${index + 1}/${total}] Region "${edit.regionId}" (line ${edit.startLine}) has been edited.\n` +
        `  Recorded hash: ${edit.recordedHash}\n` +
        `  Current hash:  ${edit.currentHash}\n`);
    if (edit.canonicalContent) {
        const preview = edit.currentContent.split("\n").slice(0, 3).join("\n");
        const canonPreview = edit.canonicalContent.split("\n").slice(0, 3).join("\n");
        process.stdout.write(`\n  --- Framework canonical (first 3 lines) ---\n${canonPreview}\n` +
            `  --- Your version (first 3 lines) ---\n${preview}\n`);
    }
    process.stdout.write(`\nResolve this edit:\n` +
        `  [o] Override — keep your edit, wrap as user-override (recommended)\n` +
        `  [d] Discard  — revert to framework canonical\n` +
        `  [s] Skip     — leave as-is; will warn on every future check\n`);
    while (true) {
        const ans = (await ask("Choice [o/d/s]: ")).trim().toLowerCase();
        if (ans === "o" || ans === "override") {
            rl.close();
            return "override";
        }
        if (ans === "d" || ans === "discard") {
            rl.close();
            return "discard";
        }
        if (ans === "s" || ans === "skip") {
            rl.close();
            return "skip";
        }
        process.stdout.write(`Invalid input "${ans}". Type o, d, or s.\n`);
    }
}
// ── Main resolver ─────────────────────────────────────────────────────────────
export async function resolveEdits(edits, opts) {
    if (edits.length === 0)
        return [];
    // Non-interactive path: apply auto-resolve to every edit
    if (!opts.interactive || !process.stdin.isTTY) {
        const action = opts.autoResolve ?? "override";
        process.stdout.write(`Non-interactive: auto-resolving ${edits.length} unauthorised edit(s) as "${action}".\n`);
        return edits.map((e) => ({ regionId: e.regionId, action }));
    }
    // Interactive path
    process.stdout.write(`\nFound ${edits.length} unauthorised edit(s) in framework regions.\n` +
        `Each one needs a decision before the migration can proceed.\n`);
    const resolutions = [];
    for (let i = 0; i < edits.length; i++) {
        const action = await promptOne(edits[i], edits.length, i);
        resolutions.push({ regionId: edits[i].regionId, action });
    }
    return resolutions;
}
// ── Application ───────────────────────────────────────────────────────────────
export function applyResolutions(sdlcContent, resolutions, registry, today = new Date().toISOString().slice(0, 10)) {
    const parsed = parseRegions(sdlcContent);
    const lines = sdlcContent.split("\n");
    const applied = [];
    const skipped = [];
    // We mutate regions in-place then re-serialise
    const regionsById = new Map();
    for (const r of parsed.regions)
        regionsById.set(r.id, r);
    for (const res of resolutions) {
        const region = regionsById.get(res.regionId);
        if (!region || region.type !== "framework") {
            skipped.push(res);
            continue;
        }
        if (res.action === "skip") {
            skipped.push(res);
            continue;
        }
        if (res.action === "discard") {
            const canonical = registry.get(res.regionId);
            if (!canonical) {
                skipped.push(res);
                continue;
            }
            region.content = canonical.content;
            applied.push(res);
            continue;
        }
        if (res.action === "override") {
            // Two steps:
            //   1. Restore the framework region to its canonical content
            //   2. Append a sibling user-override block carrying the user's edit
            const canonical = registry.get(res.regionId);
            if (!canonical) {
                // No canonical to restore to — fall back to leaving the dirty content in place
                // but still wrap it as user-override so future checks pass.
                skipped.push(res);
                continue;
            }
            // The override block to inject after the framework region
            const overrideId = `${res.regionId}-override`;
            const overrideContent = region.content; // user's current edit
            const overrideBlock = [
                `<!-- SDLC:start type="user-override" overrides="${res.regionId}" original-hash="${canonical.hash}" created="${today}" -->`,
                overrideContent,
                `<!-- SDLC:end overrides="${res.regionId}" -->`,
            ].join("\n");
            // Restore framework canonical
            region.content = canonical.content;
            // Mark framework region as overridden-by — synthesise a fake region for the override
            const overrideRegion = {
                id: overrideId,
                type: "user-override",
                startLine: -1, endLine: -1,
                contentStartLine: -1, contentEndLine: -1,
                content: overrideContent,
                rawOpenTag: `<!-- SDLC:start type="user-override" overrides="${res.regionId}" original-hash="${canonical.hash}" created="${today}" -->`,
                overrides: res.regionId,
                originalHash: canonical.hash,
                createdAt: today,
                children: [],
                dirty: false,
                overrideStale: false,
            };
            // We re-serialise the regions then post-inject the override block right
            // after the framework region's end tag. (Doing this with serializeRegions
            // alone would require a richer API; the post-inject keeps the code small.)
            // Mark the resolution as applied; the post-injection happens below.
            applied.push(res);
            // Stash the override block on the region for injection later
            region._injectAfter = overrideBlock;
        }
    }
    // Re-serialise with framework content restored
    let newContent = serializeRegions(lines, parsed.regions);
    // Post-inject override blocks. We do this after serialise so we don't need to
    // teach the serializer about insertion. Find each framework region's end tag
    // and append the override block after it.
    for (const r of parsed.regions) {
        const inject = r._injectAfter;
        if (!inject)
            continue;
        const endTagPattern = new RegExp(`(<!--\\s*SDLC:end\\s+id="${r.id}"\\s*-->)`, "m");
        newContent = newContent.replace(endTagPattern, `$1\n${inject}`);
    }
    return { newContent, applied, skipped };
}
// ── Helper for migrate.ts: load the canonical registry by file path ──────────
export function loadRegistryFile(registryPath) {
    const json = readFileSync(registryPath, "utf-8");
    return deserializeRegistry(json).registry;
}
//# sourceMappingURL=resolve-edits.js.map