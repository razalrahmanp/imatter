import type { GateStatus } from "./sdlc.js";
export interface EntryVerifyResult {
    stage: number;
    name: string;
    gate: string;
    cleared_at: string;
    score: number;
    hmac: "valid" | "invalid" | "unsigned";
    docHash: "valid" | "invalid" | "not_on_disk" | "not_recorded";
}
export interface HistoryVerifyReport {
    ok: boolean;
    keyPresent: boolean;
    topLevel: "valid" | "invalid" | "unsigned";
    cursor: "valid" | "invalid" | "unsigned";
    entries: EntryVerifyResult[];
    errors: string[];
    warnings: string[];
}
export declare function buildHistoryVerifyReport(projectRoot: string): HistoryVerifyReport;
export interface RequirementHit {
    line: number;
    text: string;
}
export interface RequirementMatch {
    sectionHeading: string;
    stageNumber: number | null;
    gateStatus: string | null;
    hits: RequirementHit[];
}
export declare function traceRequirementsInDoc(content: string, reqId: string, caseSensitive: boolean, gateStatuses: GateStatus[]): RequirementMatch[];
