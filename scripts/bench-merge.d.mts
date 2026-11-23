/** Types of scripts/bench-merge.mjs, for the tests that import it. */
export interface RunResult {
  size?: number;
  backend?: string;
  workload: string;
  path?: string;
  system?: string;
  medianMs: number;
  samplesMs: number[];
  run?: number;
}
export interface Run {
  version: string;
  runtime: string;
  runtimeVersion: string;
  repeats: number;
  warmups: number;
  recordedAt: string;
  loadAverage: number[] | { start: number[]; end: number[] };
  loadAverageEnd?: number[];
  flushProbe?: { bytes: number; medianMs: number; run?: number };
  results: RunResult[];
  runs?: { count: number; measured: { recordedAt: string; loadStart: number; loadEnd: number }[] };
}
export const REPORTS: string[];
export function mergeRuns(runs: readonly Run[]): Run;
export function runSpread(runs: readonly Run[]): number;
export function readRuns(directory: string, name: string, count: number): Promise<Run[]>;
export function assertMerged(directory: string, name: string, report: Run): Promise<Run[]>;
