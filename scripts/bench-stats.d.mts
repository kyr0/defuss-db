/** Types of scripts/bench-stats.mjs, for the tests that import it. */
export interface PairedRatio {
  ratio: number;
  low: number;
  high: number;
  rounds: number;
}
export function pairedRatio(a: readonly number[], b: readonly number[]): PairedRatio;
export function verdict(interval: { low: number; high: number }): 'faster' | 'slower' | 'same';
