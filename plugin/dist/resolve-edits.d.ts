import { type CanonicalRegistry } from "./template-generator.js";
export type ResolutionAction = "override" | "discard" | "skip";
export interface UnauthorisedEdit {
    regionId: string;
    startLine: number;
    recordedHash: string;
    currentHash: string;
    currentContent: string;
    canonicalContent?: string;
}
export interface Resolution {
    regionId: string;
    action: ResolutionAction;
}
export interface ResolveOptions {
    interactive: boolean;
    autoResolve?: ResolutionAction;
}
export declare function detectEdits(sdlcContent: string, registry?: CanonicalRegistry): UnauthorisedEdit[];
export declare function resolveEdits(edits: UnauthorisedEdit[], opts: ResolveOptions): Promise<Resolution[]>;
export declare function applyResolutions(sdlcContent: string, resolutions: Resolution[], registry: CanonicalRegistry, today?: string): {
    newContent: string;
    applied: Resolution[];
    skipped: Resolution[];
};
export declare function loadRegistryFile(registryPath: string): CanonicalRegistry;
