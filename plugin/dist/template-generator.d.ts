export type CanonicalRegistry = Map<string, {
    content: string;
    hash: string;
    since: string;
}>;
export interface GenerateResult {
    tagged: string;
    registry: CanonicalRegistry;
    unknownSections: string[];
}
export declare function generateTaggedTemplate(sourceContent: string, version: string): GenerateResult;
export interface RegistryEntry {
    id: string;
    hash: string;
    since: string;
    content: string;
}
export declare function serializeRegistry(registry: CanonicalRegistry, version: string): string;
export declare function deserializeRegistry(json: string): {
    version: string;
    registry: CanonicalRegistry;
};
