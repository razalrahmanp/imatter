#!/usr/bin/env node
export interface ChangelogEntry {
    version: string;
    date: string;
    headline: string;
    body: string;
}
export declare function parseChangelog(content: string): ChangelogEntry[];
