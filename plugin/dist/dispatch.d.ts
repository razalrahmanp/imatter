export interface DispatchAgent {
    ns: string;
    id: string;
    check: string;
    model: "haiku" | "sonnet" | "opus";
    status: "pending" | "reported" | "failed";
    reported_at?: string;
}
export interface DispatchRecord {
    dispatch_id: string;
    stage: number;
    created_at: string;
    completed_at?: string;
    agents: DispatchAgent[];
}
export declare function dispatchDir(projectRoot: string): string;
export declare function dispatchPath(projectRoot: string, stage: number): string;
export declare function readDispatch(projectRoot: string, stage: number): DispatchRecord | null;
export declare function writeDispatch(projectRoot: string, record: DispatchRecord): void;
export declare function makeDispatchId(stage: number): string;
