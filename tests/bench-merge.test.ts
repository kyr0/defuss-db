import { describe, expect, it } from 'vitest';
import { mergeRuns, runSpread, type Run, type RunResult } from '../scripts/bench-merge.mjs';

const result = (
  workload: string,
  path: string,
  medianMs: number,
  backend = 'memory',
): RunResult => ({
  backend,
  workload,
  path,
  medianMs,
  samplesMs: [medianMs],
});
const run = (minute: number, results: RunResult[], extra: Partial<Run> = {}): Run => ({
  version: '3.2.0',
  runtime: 'Node',
  runtimeVersion: 'v26.13.1',
  repeats: 7,
  warmups: 2,
  recordedAt: `2026-11-23T17:0${minute}:00.000Z`,
  loadAverage: { start: [minute, 0, 0], end: [minute + 0.5, 0, 0] },
  results,
  ...extra,
});

describe('least disturbed of several benchmark runs', () => {
  it('takes each workload from the run with the lowest medians and records the choice', () => {
    const merged = mergeRuns([
      run(1, [
        result('feed', 'ordered', 2),
        result('feed', 'scan', 20),
        result('get', 'tracked', 1),
      ]),
      run(2, [
        result('feed', 'ordered', 1),
        result('feed', 'scan', 10),
        result('get', 'tracked', 3),
      ]),
      run(3, [
        result('feed', 'ordered', 3),
        result('feed', 'scan', 30),
        result('get', 'tracked', 2),
      ]),
    ]);
    expect(merged.results.map((r) => [r.workload, r.path, r.medianMs, r.run])).toEqual([
      ['feed', 'ordered', 1, 2],
      ['feed', 'scan', 10, 2],
      ['get', 'tracked', 1, 1],
    ]);
    expect(merged.runs).toEqual({
      count: 3,
      measured: [
        { recordedAt: '2026-11-23T17:01:00.000Z', loadStart: 1, loadEnd: 1.5 },
        { recordedAt: '2026-11-23T17:02:00.000Z', loadStart: 2, loadEnd: 2.5 },
        { recordedAt: '2026-11-23T17:03:00.000Z', loadStart: 3, loadEnd: 3.5 },
      ],
    });
    // Everything but the timings is the first run's.
    expect(merged.recordedAt).toBe('2026-11-23T17:01:00.000Z');
  });

  it('keeps the compared paths of a workload in one run, by the geometric mean of their medians', () => {
    // Run 1 holds the fastest ordered path, but its scan was disturbed: geometric means sqrt(10) and 2.
    const merged = mergeRuns([
      run(1, [result('feed', 'ordered', 1), result('feed', 'scan', 10)]),
      run(2, [result('feed', 'ordered', 2), result('feed', 'scan', 2)]),
    ]);
    expect(merged.results.map((r) => [r.medianMs, r.run])).toEqual([
      [2, 2],
      [2, 2],
    ]);
  });

  it('separates the same workload on another backend or size, and keeps the earliest run on a tie', () => {
    const merged = mergeRuns([
      run(1, [result('get', 'tracked', 1), result('get', 'tracked', 9, 'directory')]),
      run(2, [result('get', 'tracked', 1), result('get', 'tracked', 4, 'directory')]),
    ]);
    expect(merged.results.map((r) => [r.backend, r.medianMs, r.run])).toEqual([
      ['memory', 1, 1],
      ['directory', 4, 2],
    ]);
    const sized = (ms: number): RunResult => ({
      size: 10000,
      workload: 'point-get',
      system: 'mongodb',
      medianMs: ms,
      samplesMs: [ms],
    });
    const mongo = mergeRuns([
      run(1, [sized(3)], {
        loadAverage: [5, 0, 0],
        loadAverageEnd: [6, 0, 0],
        flushProbe: { bytes: 4096, medianMs: 9 },
      }),
      run(2, [sized(2)], {
        loadAverage: [7, 0, 0],
        loadAverageEnd: [8, 0, 0],
        flushProbe: { bytes: 4096, medianMs: 4 },
      }),
    ]);
    expect(mongo.results[0]).toMatchObject({ medianMs: 2, run: 2 });
    expect(mongo.flushProbe).toEqual({ bytes: 4096, medianMs: 4, run: 2 });
    expect(mongo.runs?.measured.map((m) => [m.loadStart, m.loadEnd])).toEqual([
      [5, 6],
      [7, 8],
    ]);
  });

  it('answers one run unchanged apart from the record of the choice', () => {
    const only = run(1, [result('get', 'tracked', 1)]);
    const merged = mergeRuns([only]);
    expect(merged.results).toEqual([{ ...only.results[0], run: 1 }]);
    expect(merged.runs?.count).toBe(1);
  });

  it('refuses runs of another build, runtime or set of series', () => {
    const a = run(1, [result('get', 'tracked', 1)]);
    expect(() => mergeRuns([])).toThrow(/at least one run/);
    expect(() => mergeRuns([a, { ...a, version: '3.1.0' }])).toThrow(/differ in version/);
    expect(() => mergeRuns([a, { ...a, runtimeVersion: 'v26.0.0' }])).toThrow(
      /differ in runtimeVersion/,
    );
    expect(() => mergeRuns([a, run(2, [result('get', 'untracked', 1)])])).toThrow(
      /different series/,
    );
  });

  it('measures how far the runs lie apart as the median factor over the series', () => {
    const runs = [
      run(1, [result('a', 'x', 1), result('b', 'x', 10), result('c', 'x', 4)]),
      run(2, [result('a', 'x', 2), result('b', 'x', 11), result('c', 'x', 2)]),
    ];
    // Factors 2, 1.1 and 2: the median is 2.
    expect(runSpread(runs)).toBe(2);
  });
});
