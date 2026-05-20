export type RegionType = "framework" | "user" | "user-override" | "placeholder";
export interface Region {
    id: string;
    type: RegionType;
    startLine: number;
    endLine: number;
    contentStartLine: number;
    contentEndLine: number;
    content: string;
    rawOpenTag: string;
    since?: string;
    hash?: string;
    overriddenBy?: string;
    locked?: boolean;
    overrides?: string;
    originalHash?: string;
    createdAt?: string;
    prompt?: string;
    children: Region[];
    parentId?: string;
    dirty: boolean;
    overrideStale: boolean;
}
export interface UntaggedBlock {
    startLine: number;
    endLine: number;
    content: string;
}
export type ParseErrorCode = "UNCLOSED_TAG" | "FRAMEWORK_IN_USER" | "NESTED_FRAMEWORK" | "DUPLICATE_ID" | "END_WITHOUT_START" | "MISSING_REQUIRED_ATTR" | "INVALID_END_TAG";
export type ParseWarningCode = "UNKNOWN_TYPE" | "UNRECOGNIZED_ATTR" | "MISSING_HASH" | "HASH_MISMATCH" | "OVERRIDE_STALE";
export interface ParseError {
    code: ParseErrorCode;
    line: number;
    message: string;
    id?: string;
}
export interface ParseWarning {
    code: ParseWarningCode;
    line: number;
    message: string;
    id?: string;
}
export interface ParseResult {
    regions: Region[];
    tree: Region[];
    untagged: UntaggedBlock[];
    errors: ParseError[];
    warnings: ParseWarning[];
    isFullyTagged: boolean;
    frameworkVersion?: string;
}
export declare function hashContent(content: string): string;
export declare function parseRegions(docContent: string): ParseResult;
/**
 * Rebuild a SDLC_VALIDATION.md from a ParseResult + original lines.
 * Framework regions whose content has changed get their hash recomputed.
 * User and user-override regions are emitted unchanged.
 */
export declare function serializeRegions(originalLines: string[], regions: Region[]): string;
