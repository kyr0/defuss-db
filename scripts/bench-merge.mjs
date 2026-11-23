// Publishes, per workload, the least disturbed of several separate benchmark runs (`make bench-runs`).
//
// Why: other processes on the host only add time to a sample, and they do so for a whole run at once, so the median
// of one run moves with the host. VERIFIED (2026-11-23, 18 cores, one-minute load 3 to 10): over eight runs of the
// same build, the median of a series differed between runs by a typical factor of 1.44 under Node.js and 1.60 under
// Bun, up to 3.3, while the published 3.1.0 package, measured in between, differed from this build by 1% in the
// median over all series. A run-to-run difference therefore says nothing about the code.
// Why the least disturbed run and not the mean or median of the runs: both keep the load in the number.
// Why one run per workload and not the lowest median per series: the paths and systems of a workload are compared
// with each other (index against scan, defuss-db against MongoDB, scripts/bench-stats.mjs), and sample i of each
// comes from the same round only within one run. The run is chosen by the geometric mean of the workload's medians,
// which favours none of the compared paths.
// VERIFIED: tests/bench-merge.test.ts; `node scripts/site-evidence.mjs --check` merges the published runs again.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const REPORTS = ['workloads-node', 'workloads-bun', 'mongodb-node', 'mongodb-bun'];
/** A workload: the results one run measures in the same rounds. */
const groupOf = (r) =>
  [r.size, r.backend, r.workload].filter((part) => part !== undefined).join('/');
const seriesOf = (r) => [groupOf(r), r.path ?? r.system].join('/');
const oneMinute = (load) => (Array.isArray(load) ? load : load.start)[0];

/**
 * One report from several runs of one benchmark script: everything but the timings comes from the first run, each
 * workload's results from the run with the lowest geometric mean of its medians (the earliest on a tie), and
 * `flushProbe` from the run with the fastest flush. `results[].run` and `runs` record the choice, counted from 1.
 */
export function mergeRuns(runs) {
  assert.ok(runs.length > 0, 'mergeRuns needs at least one run.');
  const [first] = runs;
  const series = first.results.map(seriesOf);
  for (const run of runs) {
    for (const key of ['version', 'runtime', 'runtimeVersion', 'repeats', 'warmups'])
      assert.equal(run[key], first[key], `Runs differ in ${key}.`);
    assert.deepEqual(run.results.map(seriesOf), series, 'Runs measured different series.');
  }
  const score = (run, group) =>
    run.results
      .filter((r) => groupOf(r) === group)
      .reduce((sum, r) => sum + Math.log(r.medianMs), 0);
  const chosen = new Map();
  for (const group of new Set(first.results.map(groupOf)))
    chosen.set(
      group,
      runs.reduce((best, run, i) => (score(run, group) < score(runs[best], group) ? i : best), 0),
    );
  const merged = {
    ...first,
    results: first.results.map((r, i) => {
      const run = chosen.get(groupOf(r));
      return { ...runs[run].results[i], run: run + 1 };
    }),
    runs: {
      count: runs.length,
      measured: runs.map((run) => ({
        recordedAt: run.recordedAt,
        loadStart: oneMinute(run.loadAverage),
        loadEnd: (run.loadAverageEnd ?? run.loadAverage.end)[0],
      })),
    },
  };
  if (first.flushProbe) {
    const run = runs.reduce(
      (best, r, i) => (r.flushProbe.medianMs < runs[best].flushProbe.medianMs ? i : best),
      0,
    );
    merged.flushProbe = { ...runs[run].flushProbe, run: run + 1 };
  }
  return merged;
}

/** How far the runs lie apart: the median, over all series, of a series' highest run median over its lowest. */
export function runSpread(runs) {
  const factors = runs[0].results
    .map((_, i) => runs.map((run) => run.results[i].medianMs))
    .map((medians) => Math.max(...medians) / Math.min(...medians))
    .sort((a, b) => a - b);
  return factors[Math.floor(factors.length / 2)];
}

/** The runs `count` of `directory`/runs/<1..count>/<name>.json, in order. */
export const readRuns = (directory, name, count) =>
  Promise.all(
    Array.from({ length: count }, async (_, i) =>
      JSON.parse(await readFile(`${directory}/runs/${i + 1}/${name}.json`, 'utf8')),
    ),
  );

/** Fails unless `report` is what mergeRuns answers for the runs stored beside it; answers those runs. */
export async function assertMerged(directory, name, report) {
  assert.ok(
    report.runs?.count > 0,
    `${directory}/${name}.json is a single run; publish the reports of \`make bench-runs\`.`,
  );
  const runs = await readRuns(directory, name, report.runs.count);
  assert.deepEqual(report, mergeRuns(runs), `${directory}/${name}.json differs from its runs.`);
  return runs;
}

// `node scripts/bench-merge.mjs <runs>` merges output/runs/<1..runs>/ into output/. The count is an argument, so
// runs a longer earlier series left behind are not read.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = Number(process.argv[2]);
  assert.ok(Number.isSafeInteger(count) && count > 0, 'usage: bench-merge.mjs <runs>');
  for (const name of REPORTS) {
    const runs = await readRuns('output', name, count);
    const merged = mergeRuns(runs);
    await writeFile(`output/${name}.json`, JSON.stringify(merged, null, 2) + '\n');
    const used = new Set(merged.results.map((r) => r.run)).size;
    console.log(
      `${new Date().toISOString()} INFO merged runs report=output/${name}.json runs=${count} used=${used} spread=${runSpread(runs).toFixed(2)}`,
    );
  }
}
