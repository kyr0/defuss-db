// Loads and validates the same-host MongoDB comparison (scripts/bench-mongo.mjs) and derives the rows that
// docs/PERFORMANCE.md and the landing page publish, so both pages print the same medians.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatMs } from '../docs/assets/bench-format.js';
import { assertPinnedRuntime, measuredEarlier } from './workload-report.mjs';
import { pairedRatio, verdict } from './bench-stats.mjs';

// [workload, label, defuss-db systems, MongoDB reference system for the ratio]
export const mongoOperations = [
  ['point-get', 'Read one document by ID', ['defuss-db'], 'mongodb'],
  [
    'tenant-feed',
    "One tenant's top 20 documents",
    ['defuss-db', 'defuss-db-index-page'],
    'mongodb',
  ],
  ['range-count', "Count one tenant's upper score half", ['defuss-db'], 'mongodb'],
  [
    'group-totals',
    'Count and sum by region, full scan',
    ['defuss-db', 'defuss-db-parallel'],
    'mongodb',
  ],
  ['group-totals-cached', 'Count and sum by region, repeated', ['defuss-db'], null],
  ['update-one', 'Update one document', ['defuss-db'], 'mongodb-journaled'],
  [
    'update-concurrent',
    'Update one document, 32 concurrent writers',
    ['defuss-db'],
    'mongodb-journaled',
  ],
  ['insert-batch', 'Insert 64 documents in one commit', ['defuss-db'], 'mongodb-journaled'],
  [
    'bulk-load',
    'Load the collection, 256 documents per commit',
    ['defuss-db'],
    'mongodb-journaled',
  ],
];
const reads = new Set([
  'point-get',
  'tenant-feed',
  'range-count',
  'group-totals',
  'group-totals-cached',
]);
const systemsFor = (workload) =>
  workload === 'group-totals-cached'
    ? ['defuss-db']
    : workload === 'bulk-load'
      ? ['defuss-db', 'mongodb-journaled']
      : reads.has(workload)
        ? [
            'defuss-db',
            ...(workload === 'tenant-feed' ? ['defuss-db-index-page'] : []),
            ...(workload === 'group-totals' ? ['defuss-db-parallel'] : []),
            'mongodb',
          ]
        : ['defuss-db', 'mongodb', 'mongodb-journaled'];

export const mongoLookup = (report, size, workload, system) =>
  report.results.find((r) => r.size === size && r.workload === workload && r.system === system);

export async function loadMongoReports(directory) {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  return Promise.all(
    ['Node', 'Bun'].map(async (runtime) => {
      const report = JSON.parse(
        await readFile(`${directory}/mongodb-${runtime.toLowerCase()}.json`, 'utf8'),
      );
      assert.equal(report.runtime, runtime);
      await assertPinnedRuntime(report);
      measuredEarlier(report.version, pkg.version);
      assert.equal(report.mongodbDriver, pkg.devDependencies.mongodb);
      assert.equal(report.repeats, 7);
      assert.equal(report.warmups, 2);
      assert.equal(report.fixture.loadRounds, 5);
      assert.ok(
        report.sizes.length > 0 && report.server.version && report.flushProbe?.medianMs > 0,
      );
      let expected = 0;
      for (const size of report.sizes)
        for (const [workload] of mongoOperations)
          for (const system of systemsFor(workload)) {
            expected++;
            const r = mongoLookup(report, size, workload, system);
            assert.ok(r, `${runtime} ${size} ${workload} ${system}`);
            assert.ok(r.samplesMs.every((n) => Number.isFinite(n) && n > 0));
            // Sample i of every system comes from round i, which pairs them for comparison().
            assert.equal(
              r.samplesMs.length,
              workload === 'bulk-load' ? report.fixture.loadRounds : report.repeats,
            );
            assert.equal(
              r.medianMs,
              [...r.samplesMs].sort((a, b) => a - b)[Math.floor(r.samplesMs.length / 2)],
            );
          }
      assert.equal(report.results.length, expected);
      for (const size of report.sizes) {
        const settled = report.compaction?.find((c) => c.size === size);
        assert.ok(
          settled && settled.settleMs >= 0 && settled.failures === 0,
          `${runtime} ${size} compaction`,
        );
      }
      // Every size ran the untimed warm-up scans. Only the largest must show a filled page cache, the one the
      // performance page quotes: DBSONL 0.9 keeps the index pages of commits since its last checkpoint in the writing
      // handle's memory, not in its cache. VERIFIED: the 10,000-document store, below minBytes and never compacted,
      // reported 0 cache pages after its warm-up, the 100,000-document one 9,092.
      const largest = Math.max(...report.sizes);
      for (const size of report.sizes) {
        assert.ok(
          report.warm?.find(
            (w) => w.size === size && (size !== largest || w.defussCacheBytes > 0),
          ),
          `${runtime} ${size} warm caches`,
        );
        assert.ok(
          report.parallel?.find((p) => p.size === size && p.workers > 0),
          `${runtime} ${size} query workers`,
        );
      }
      return report;
    }),
  );
}

/**
 * The faster defuss-db path by median against the MongoDB reference, as the paired time ratio with its 95% confidence
 * interval and verdict (scripts/bench-stats.mjs).
 */
export function comparison(report, size, workload) {
  const [, , systems, reference] = mongoOperations.find(([w]) => w === workload);
  const best = systems
    .map((system) => mongoLookup(report, size, workload, system))
    .reduce((a, b) => (b.medianMs < a.medianMs ? b : a));
  const paired = pairedRatio(best.samplesMs, mongoLookup(report, size, workload, reference).samplesMs);
  return { system: best.system, ...paired, verdict: verdict(paired) };
}
const factor = (x) => (x < 2 ? x.toFixed(2) : x.toFixed(1));
/** "8.4× faster (95% CI 7.2–9.7×)", "1.21× slower (95% CI 1.01–1.46×)" or "no clear difference (…)". */
export function relativeText({ ratio, low, high, verdict }) {
  if (verdict === 'faster')
    return `${factor(1 / ratio)}× faster (95% CI ${factor(1 / high)}–${factor(1 / low)}×)`;
  if (verdict === 'slower')
    return `${factor(ratio)}× slower (95% CI ${factor(low)}–${factor(high)}×)`;
  return `no clear difference (95% CI ${factor(low)}–${factor(high)}× the time)`;
}

/** One row per workload and size: formatted cells for both pages. */
export function mongoRows(report) {
  // VERIFIED: defuss-storage 0.4.1 flushes the drive cache under Node.js and Bun alike (4.2 and 4.9 ms per 4 KiB flush on
  // macOS arm64), so every write compares with MongoDB's journaled writes.
  const rows = [];
  for (const size of report.sizes)
    for (const [workload, label, defussSystems, reference] of mongoOperations) {
      const get = (system) => mongoLookup(report, size, workload, system)?.medianMs;
      const defuss = defussSystems.map(get);
      rows.push({
        size,
        workload,
        label,
        defuss: defuss.map(formatMs).join(' / '),
        mongodb: get('mongodb') === undefined ? 'n/a' : formatMs(get('mongodb')),
        journaled:
          get('mongodb-journaled') === undefined ? 'n/a' : formatMs(get('mongodb-journaled')),
        ratio: !reference
          ? 'no MongoDB equivalent'
          : relativeText(comparison(report, size, workload)),
      });
    }
  return rows;
}

const pathNames = {
  'defuss-db': 'query API',
  'defuss-db-index-page': 'pageByIndex()',
  'defuss-db-parallel': 'query workers',
  mongodb: 'MongoDB',
  'mongodb-journaled': 'MongoDB j: true',
};
/**
 * What the landing page's comparison charts plot: per runtime and size, each workload that has a MongoDB counterpart
 * with the faster defuss-db path's median, the reference MongoDB median, and their paired time ratio with its 95%
 * confidence interval and verdict. scripts/check-site.mjs recomputes it.
 */
export function mongoChartData(reports) {
  return reports.map((report) => ({
    runtime: report.runtime,
    runtimeVersion: report.runtimeVersion.replace(/^v/, ''),
    sizes: report.sizes,
    rows: report.sizes.flatMap((size) =>
      mongoOperations
        .filter(([, , , reference]) => reference)
        .map(([workload, label, , reference]) => {
          const c = comparison(report, size, workload);
          return {
            size,
            workload,
            label,
            defussMs: mongoLookup(report, size, workload, c.system).medianMs,
            defussPath: pathNames[c.system],
            mongoMs: mongoLookup(report, size, workload, reference).medianMs,
            mongoPath: pathNames[reference],
            ratio: c.ratio,
            low: c.low,
            high: c.high,
            rounds: c.rounds,
            verdict: c.verdict,
          };
        }),
    ),
  }));
}
