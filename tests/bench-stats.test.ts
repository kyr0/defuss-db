import { describe, expect, it } from 'vitest';
import { pairedRatio, verdict } from '../scripts/bench-stats.mjs';

describe('paired benchmark ratios', () => {
  it('gives the geometric mean of per-round ratios with a Student-t 95% interval', () => {
    // Log ratios ln 2 ± ln 1.1 over 3 rounds: mean ln 2, sd ln 1.1, t(2) = 4.303.
    const r = pairedRatio([2.2, 2, 2 / 1.1], [1, 1, 1]);
    expect(r.ratio).toBeCloseTo(2, 10);
    const half = (4.303 * Math.log(1.1)) / Math.sqrt(3);
    expect(r.low).toBeCloseTo(2 * Math.exp(-half), 10);
    expect(r.high).toBeCloseTo(2 * Math.exp(half), 10);
    expect(r.rounds).toBe(3);
  });

  it('cancels drift that hits both systems in the same round', () => {
    // The host slows down round by round; system a stays 20% faster within every round.
    const b = [1, 2, 4, 8, 16];
    const r = pairedRatio(b.map((ms) => ms * 0.8), b);
    expect(r.ratio).toBeCloseTo(0.8, 10);
    expect(r.high - r.low).toBeCloseTo(0, 10);
    expect(verdict(r)).toBe('faster');
  });

  it('names a winner only when the whole interval lies on one side of 1', () => {
    expect(verdict({ low: 0.5, high: 0.99 })).toBe('faster');
    expect(verdict({ low: 1.01, high: 1.5 })).toBe('slower');
    expect(verdict({ low: 0.95, high: 1.2 })).toBe('same');
    expect(verdict(pairedRatio([1.1, 0.9, 1.05, 0.97], [1, 1, 1, 1]))).toBe('same');
  });

  it('rejects unpaired, too short or non-positive samples', () => {
    expect(() => pairedRatio([1, 2], [1])).toThrow(RangeError);
    expect(() => pairedRatio([1], [1])).toThrow(RangeError);
    expect(() => pairedRatio([1, 0], [1, 1])).toThrow(RangeError);
  });
});
