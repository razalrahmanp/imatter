export interface GateStatus {
    stage: number;
    name: string;
    status: "NOT STARTED" | "IN PROGRESS" | "PASSED" | "ONGOING";
    passedDate?: string;
}
export declare function resolveProjectRoot(override?: string): string;
export declare function findSdlcFile(projectRoot: string): string;
export declare function readSdlcContent(sdlcPath: string): string;
export declare function getGateStatuses(content: string): GateStatus[];
export declare function getSdlcSection(content: string, heading: string): string;
/** Append a Markdown table row to the last table in a given section. */
export declare function appendTableRow(sdlcPath: string, sectionHeading: string, newRow: string): {
    lineNumber: number;
};
export declare function artifactInfo(artifactPath: string, projectRoot: string): {
    exists: boolean;
    fullPath: string;
    lineCount?: number;
    isDir?: boolean;
};
