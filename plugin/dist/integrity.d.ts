export declare function keyPath(projectRoot: string): string;
/** Generate a fresh key if none exists; return the key hex string. */
export declare function ensureKey(projectRoot: string): string;
/** Load existing key; returns null if not present (pre-integrity state). */
export declare function loadKey(projectRoot: string): string | null;
export declare function fileHash(filePath: string): string;
export interface EntryFields {
    stage: number;
    name: string;
    gate: string;
    cleared_at: string;
    summary: string;
    doc: string;
    doc_sha256?: string | null;
    score: number;
}
export declare function computeEntryHmac(entry: EntryFields, key: string): string;
export interface CursorFields {
    stage: number;
    status: string;
    fail_count: number;
    started_at: string;
}
export declare function computeCursorHmac(cursor: CursorFields, key: string): string;
export declare function computeTopLevelHmac(state: Record<string, unknown>, key: string): string;
export interface VerifyResult {
    ok: boolean;
    errors: string[];
    warnings: string[];
    keyMissing: boolean;
}
export declare function verifyState(state: Record<string, unknown>, projectRoot: string): VerifyResult;
export declare function signState(state: Record<string, unknown>, projectRoot: string): Record<string, unknown>;
export interface LockInfo {
    session_id: string;
    started_at: string;
    pid: number;
    host: string;
}
export declare function lockPath(projectRoot: string): string;
export interface AcquireResult {
    acquired: boolean;
    takenOver?: boolean;
    conflict?: LockInfo;
}
export declare function acquireLock(projectRoot: string, sessionId: string): AcquireResult;
export declare function releaseLock(projectRoot: string): boolean;
