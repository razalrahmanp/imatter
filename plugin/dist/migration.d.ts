import { type ParseResult } from "./regions.js";
export interface MigrationContext {
    parsed: ParseResult;
    lines: string[];
    fromVersion: string;
    toVersion: string;
    projectRoot: string;
}
export interface MigrationResult {
    newContent: string;
    changes: string[];
    warnings: string[];
}
export interface MigrationScript {
    from: string;
    to: string;
    description: string;
    apply(ctx: MigrationContext): MigrationResult;
}
export interface RunOptions {
    projectRoot: string;
    sdlcPath: string;
    fromVersion: string;
    toVersion: string;
    scripts: MigrationScript[];
    registryPath: string;
    dryRun?: boolean;
}
export interface RunResult {
    steps: StepResult[];
    finalContent: string;
    finalVersion: string;
    backupPath: string | null;
    allChanges: string[];
    allWarnings: string[];
}
interface StepResult {
    from: string;
    to: string;
    description: string;
    changes: string[];
    warnings: string[];
    skipped: boolean;
}
export declare function runMigrations(opts: RunOptions): Promise<RunResult>;
/**
 * Replace a framework region's content.
 * Leaves user and user-override regions untouched.
 * Returns the new document string with the hash recomputed.
 */
export declare function replaceFrameworkRegion(content: string, regionId: string, newRegionContent: string): string;
/**
 * Insert a new region pair (framework + optional user sibling) after a named anchor region.
 * Used when a migration adds a new section to the document.
 */
export declare function insertRegionAfter(content: string, afterId: string, newRegion: {
    id: string;
    type: "framework" | "user";
    since: string;
    regionContent: string;
    userSiblingId?: string;
}): string;
/**
 * Check whether a region exists and is clean (not dirty, not stale).
 * Used by migration scripts to decide whether to apply a change.
 */
export declare function regionStatus(parsed: ParseResult, regionId: string): "clean" | "dirty" | "missing" | "user-override";
export declare function applyRegistryUpdate(content: string, registryPath: string): {
    newContent: string;
    updated: string[];
};
export {};
