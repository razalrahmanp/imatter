import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
export function dispatchDir(projectRoot) {
    const dir = join(projectRoot, ".sdlc-dispatch");
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    return dir;
}
export function dispatchPath(projectRoot, stage) {
    return join(dispatchDir(projectRoot), `stage-${stage}.json`);
}
export function readDispatch(projectRoot, stage) {
    const p = dispatchPath(projectRoot, stage);
    if (!existsSync(p))
        return null;
    return JSON.parse(readFileSync(p, "utf-8"));
}
export function writeDispatch(projectRoot, record) {
    const p = dispatchPath(projectRoot, record.stage);
    writeFileSync(p, JSON.stringify(record, null, 2), "utf-8");
}
export function makeDispatchId(stage) {
    // Include time component to prevent same-day collisions when re-dispatching
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `d-${ts}-stage${stage}`;
}
//# sourceMappingURL=dispatch.js.map