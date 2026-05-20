import { createHmac, createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { hostname } from "node:os";
const HMAC_ALG = "sha256";
// ── Key management ────────────────────────────────────────────────────────────
export function keyPath(projectRoot) {
    return join(projectRoot, ".sdlc", "keys", "state.key");
}
/** Generate a fresh key if none exists; return the key hex string. */
export function ensureKey(projectRoot) {
    const kp = keyPath(projectRoot);
    if (existsSync(kp))
        return readFileSync(kp, "utf-8").trim();
    mkdirSync(dirname(kp), { recursive: true });
    const key = randomBytes(32).toString("hex");
    writeFileSync(kp, key + "\n", { encoding: "utf-8", mode: 0o600 });
    return key;
}
/** Load existing key; returns null if not present (pre-integrity state). */
export function loadKey(projectRoot) {
    const kp = keyPath(projectRoot);
    if (!existsSync(kp))
        return null;
    const key = readFileSync(kp, "utf-8").trim();
    return key || null;
}
// ── Hashing helpers ───────────────────────────────────────────────────────────
export function fileHash(filePath) {
    const content = readFileSync(filePath);
    return createHash(HMAC_ALG).update(content).digest("hex");
}
function hmac(data, key) {
    return createHmac(HMAC_ALG, key).update(data).digest("hex");
}
export function computeEntryHmac(entry, key) {
    return hmac(JSON.stringify({
        stage: entry.stage,
        name: entry.name,
        gate: entry.gate,
        cleared_at: entry.cleared_at,
        summary: entry.summary,
        doc: entry.doc,
        doc_sha256: entry.doc_sha256 ?? null,
        score: entry.score,
    }), key);
}
export function computeCursorHmac(cursor, key) {
    return hmac(JSON.stringify({
        stage: cursor.stage,
        status: cursor.status,
        fail_count: cursor.fail_count,
        started_at: cursor.started_at,
    }), key);
}
// ── Top-level signature ───────────────────────────────────────────────────────
// Covers the entire state object — excluding _signature itself.
// Reordering history, adding fake entries, or deleting entries all break this.
export function computeTopLevelHmac(state, key) {
    const { _signature, ...rest } = state;
    void _signature; // excluded from signature input
    return hmac(JSON.stringify(rest), key);
}
export function verifyState(state, projectRoot) {
    const errors = [];
    const warnings = [];
    const key = loadKey(projectRoot);
    if (!key) {
        return {
            ok: true,
            errors: [],
            warnings: ["Integrity key not found. State is unprotected — any edits will be undetected. Run sdlc_state_create to generate a key."],
            keyMissing: true,
        };
    }
    // 1. Top-level HMAC
    const sig = state._signature?.value;
    if (sig) {
        if (computeTopLevelHmac(state, key) !== sig) {
            errors.push("STATE FILE TAMPERED — top-level HMAC mismatch. Refuse to proceed until state is restored from git.");
        }
    }
    else {
        warnings.push("No top-level signature — state pre-dates integrity protection.");
    }
    // 2. Cursor HMAC
    const cursor = state.cursor;
    if (cursor?.hmac) {
        if (computeCursorHmac(cursor, key) !== cursor.hmac) {
            errors.push("CURSOR TAMPERED — cursor.hmac mismatch.");
        }
    }
    // 3. History entry HMACs + findings doc hashes
    const history = state.history ?? [];
    for (const entry of history) {
        if (entry.hmac) {
            if (computeEntryHmac(entry, key) !== entry.hmac) {
                errors.push(`HISTORY TAMPERED — Stage ${entry.stage} (${entry.name}) entry HMAC mismatch.`);
            }
        }
        else {
            warnings.push(`Stage ${entry.stage} history entry is unsigned (pre-integrity).`);
        }
        // Findings doc hash check (if doc_sha256 was recorded at gate time)
        if (entry.doc_sha256 && entry.doc) {
            try {
                const docAbsPath = entry.doc.startsWith("/") || /^[A-Za-z]:\\/.test(entry.doc)
                    ? entry.doc
                    : join(projectRoot, entry.doc);
                if (existsSync(docAbsPath)) {
                    const onDisk = fileHash(docAbsPath);
                    if (onDisk !== entry.doc_sha256) {
                        errors.push(`FINDINGS TAMPERED — Stage ${entry.stage} (${entry.name}) findings doc hash mismatch: ${entry.doc}`);
                    }
                }
                else {
                    warnings.push(`Stage ${entry.stage} findings doc not found on disk: ${entry.doc}`);
                }
            }
            catch {
                warnings.push(`Stage ${entry.stage} findings doc hash check failed (read error).`);
            }
        }
    }
    return { ok: errors.length === 0, errors, warnings, keyMissing: false };
}
// ── State signing ─────────────────────────────────────────────────────────────
// Called inside writeState before serialisation.
export function signState(state, projectRoot) {
    const key = loadKey(projectRoot);
    if (!key)
        return state; // no key yet — can't sign
    // Sign each history entry
    const history = state.history ?? [];
    const signedHistory = history.map((entry) => ({
        ...entry,
        hmac: computeEntryHmac(entry, key),
    }));
    // Sign cursor
    const cursor = state.cursor;
    const signedCursor = { ...cursor, hmac: computeCursorHmac(cursor, key) };
    // Build unsigned state (remove stale _signature)
    const { _signature: _old, ...rest } = state;
    void _old;
    const partialState = { ...rest, cursor: signedCursor, history: signedHistory };
    // Top-level HMAC over the fully signed state
    const topHmac = computeTopLevelHmac(partialState, key);
    return {
        ...partialState,
        _signature: {
            algorithm: "HMAC-SHA256",
            key_source: ".sdlc/keys/state.key",
            computed_at: new Date().toISOString(),
            value: topHmac,
        },
    };
}
export function lockPath(projectRoot) {
    return join(projectRoot, ".sdlc-state.lock");
}
function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
export function acquireLock(projectRoot, sessionId) {
    const lp = lockPath(projectRoot);
    if (existsSync(lp)) {
        let existing;
        try {
            existing = JSON.parse(readFileSync(lp, "utf-8"));
        }
        catch {
            // Corrupt lock — take over
            writeLock(lp, sessionId);
            return { acquired: true, takenOver: true };
        }
        const ageMs = Date.now() - new Date(existing.started_at).getTime();
        const isStale = ageMs > 6 * 60 * 60 * 1000; // 6 hours
        const isAlive = isPidAlive(existing.pid);
        if (!isStale && isAlive) {
            // Active session from a different process — do not take over
            return { acquired: false, conflict: existing };
        }
        // Stale or dead — take over
        writeLock(lp, sessionId);
        return { acquired: true, takenOver: true };
    }
    writeLock(lp, sessionId);
    return { acquired: true };
}
function writeLock(lp, sessionId) {
    const lock = {
        session_id: sessionId,
        started_at: new Date().toISOString(),
        pid: process.pid,
        host: hostname(),
    };
    writeFileSync(lp, JSON.stringify(lock, null, 2), "utf-8");
}
export function releaseLock(projectRoot) {
    const lp = lockPath(projectRoot);
    if (existsSync(lp)) {
        unlinkSync(lp);
        return true;
    }
    return false;
}
//# sourceMappingURL=integrity.js.map