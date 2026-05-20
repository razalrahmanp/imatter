export declare const FRAMEWORK_VERSION = "1.1.0";
export interface AgentFinding {
    /** not_applicable: criterion is irrelevant to this project — counts as neutral, not pass or fail */
    status: "pass" | "fail" | "acknowledged" | "not_applicable";
    /** true → gate cannot decide; escalates to human without consuming fail_count */
    requires_human_judgment?: boolean;
    summary: string;
    artifacts: string[];
    flags: string[];
}
export interface SubAgentConfig {
    id: string;
    check: string;
    model: "haiku" | "sonnet" | "opus";
    ns: string;
}
export interface GateCriterion {
    ns: string;
    must: "pass" | "pass_or_acknowledge" | "warn_ok";
    /** "blocking" (default) = criterion failure → FAIL. "concern" = failure → CONCERNS but gate still advances. */
    severity?: "blocking" | "concern";
}
export interface Waiver {
    stage: number;
    criterion_ns: string;
    reason: string;
    approved_by: string;
    waived_at: string;
}
export interface ReviewerConfig {
    /** Roles that satisfy the review requirement (any one suffices unless min_approvals > 1) */
    roles?: string[];
    /** Minimum distinct approvers required. Default 1. */
    min_approvals?: number;
}
export interface StageConfig {
    name: string;
    sdlc_heading: string;
    imports: Array<{
        stage: number;
        key: string;
    }>;
    sub_agents: SubAgentConfig[];
    gate: {
        rule: string;
        criteria: GateCriterion[];
        conflict_threshold: number;
        /** When set, gate cannot advance without explicit sdlc_signoff. */
        reviewer?: ReviewerConfig;
    };
    memory: Record<string, AgentFinding | null>;
}
export interface HistoryEntry {
    stage: number;
    name: string;
    gate: "PASSED" | "PASSED_WITH_CONCERNS" | "FAILED" | "WAIVED";
    cleared_at: string;
    summary: string;
    doc: string;
    doc_sha256?: string | null;
    exports: string[];
    score: number;
    concerns?: string[];
    verified_with_framework_version?: string;
    hmac?: string;
}
export interface PendingSignoff {
    gate_verdict: "PASSED" | "PASSED_WITH_CONCERNS";
    gate_score: number;
    required_roles?: string[];
    requested_at: string;
}
export interface Cursor {
    stage: number;
    status: "in_progress" | "gate_failed" | "awaiting_review" | "pending_signoff";
    fail_count: number;
    started_at: string;
    pending_signoff?: PendingSignoff;
    hmac?: string;
}
export interface Signature {
    algorithm: string;
    key_source: string;
    computed_at: string;
    value: string;
}
export interface PendingReview {
    stage: number;
    stage_summary: string;
    doc_path: string;
    doc_sha256: string | null;
    gate_verdict: "PASSED" | "PASSED_WITH_CONCERNS";
    gate_score: number;
    concerns?: string[];
    flags: string[];
    requested_at: string;
}
export interface SdlcState {
    schema: string;
    sdlc_framework_version: string;
    project_root: string;
    sdlc_file: string;
    cursor: Cursor;
    history: HistoryEntry[];
    stages: Record<string, StageConfig>;
    flagged: number[];
    waivers: Waiver[];
    pending_review?: PendingReview;
    _signature?: Signature;
}
export interface TaskIteration {
    n: number;
    status: "in_progress" | "blocked" | "complete";
    changes: string;
    next_action: string;
    error?: string;
    error_lines?: string[];
    timestamp: string;
}
export interface TaskCheckpoint {
    task_id: string;
    file: string;
    stage: number;
    plan_ref?: string;
    iterations: TaskIteration[];
    current_iteration: number;
    status: "in_progress" | "blocked" | "complete" | "flagged";
    fail_count: number;
    started_at: string;
    updated_at: string;
}
export type ErrorKind = "type_error" | "lint_error" | "test_fail" | "import_error" | "syntax_error" | "build_error" | "unknown";
export interface DiagnosedError {
    kind: ErrorKind;
    severity: "error" | "warning";
    file: string;
    line?: number;
    col?: number;
    message: string;
    raw_excerpt: string;
    fix_hint?: string;
}
export declare function statePath(projectRoot: string): string;
export declare function readState(projectRoot: string): SdlcState;
/** Atomic write: tmp file → rename. Signs state before serializing. */
export declare function writeState(projectRoot: string, state: SdlcState): void;
export declare function ensureSessionDir(projectRoot: string): string;
export declare function parseFrontmatter(filepath: string): Record<string, unknown>;
export declare function extractExport(frontmatter: Record<string, unknown>, key: string): unknown;
export interface GateResult {
    verdict: "PASS" | "CONCERNS" | "FAIL" | "BLOCKED" | "WAIVED" | "HUMAN_JUDGMENT";
    score: number;
    reason: string;
    concerns?: string[];
    missing_ns?: string[];
    failed_criteria?: string[];
    conflicts?: string[];
    needs_arbitration: boolean;
    waiver_reason?: string;
    /** set when verdict=HUMAN_JUDGMENT — which namespace triggered escalation */
    human_judgment_ns?: string;
}
export declare function runGateSynthesis(config: StageConfig): GateResult;
export declare function taskDir(projectRoot: string): string;
export declare function taskPath(projectRoot: string, taskId: string): string;
export declare function readTask(projectRoot: string, taskId: string): TaskCheckpoint | null;
export declare function writeTask(projectRoot: string, task: TaskCheckpoint): void;
export declare function diagnoseError(rawOutput: string, filePath: string): DiagnosedError[];
