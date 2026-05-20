import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

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

export function dispatchDir(projectRoot: string): string {
  const dir = join(projectRoot, ".sdlc-dispatch");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function dispatchPath(projectRoot: string, stage: number): string {
  return join(dispatchDir(projectRoot), `stage-${stage}.json`);
}

export function readDispatch(projectRoot: string, stage: number): DispatchRecord | null {
  const p = dispatchPath(projectRoot, stage);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8")) as DispatchRecord;
}

export function writeDispatch(projectRoot: string, record: DispatchRecord): void {
  const p = dispatchPath(projectRoot, record.stage);
  writeFileSync(p, JSON.stringify(record, null, 2), "utf-8");
}

export function makeDispatchId(stage: number): string {
  // Include time component to prevent same-day collisions when re-dispatching
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `d-${ts}-stage${stage}`;
}
