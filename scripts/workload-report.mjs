import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
export { formatMs } from '../docs/assets/bench-format.js';

export const operations = [
  ['tenant-feed', 'ordered', 'Tenant feed, 20 complete events', 'Compound index'],
  ['tenant-feed', 'scan', 'Tenant feed, 20 complete events', 'Collection scan'],
  ['append-events', 'ordered', 'Commit 64 events', 'With the compound index'],
  ['append-events', 'plain', 'Commit 64 events', 'Primary keys only'],
  ['live-get', 'untracked', 'Current document', 'Untracked collection'],
  ['live-get', 'tracked', 'Current document', 'Tracked collection'],
  ['past-get', 'effective', 'Historical document', 'Effective date'],
  ['past-get', 'as-recorded', 'Historical document', 'Effective date and recorded cutoff'],
  ['live-update', 'untracked', 'Commit one update', 'Untracked collection'],
  ['live-update', 'tracked', 'Commit one update', 'Tracked collection'],
  ['past-correct', 'tracked', 'Correct a closed interval', 'One document'],
  ['past-delete', 'tracked', 'Delete a closed interval', 'One document'],
  ['past-count', 'scan', 'Count historical documents', 'Full scan'],
  ['past-count', 'cached-result', 'Count historical documents', 'Warm result cache'],
  ['past-id-page', 'cold-index', 'Historical page of 32 IDs', 'Build postings and read page'],
  ['past-id-page', 'warm-index', 'Historical page of 32 IDs', 'Read retained postings'],
  ['ordered-page', 'ids', 'Ordered page of 20 IDs', 'Live index'],
  ['ordered-page', 'documents', 'Ordered page of 20 documents', 'Live index and document lookup'],
  ['range-count', 'index', 'Count 64 index entries', 'Live index'],
  ['search', 'lexical', 'Search for five documents', 'Warm lexical engine'],
  ['search', 'vector', 'Search for five documents', 'Warm vector engine'],
  ['search', 'hybrid', 'Search for five documents', 'Warm hybrid engine'],
];
export const memoryQueries = [
  ['tenant-top', 'database', 'Tenant top 20', 'Database'],
  ['tenant-top', 'array', 'Tenant top 20', 'Raw DataView on a resident JS array'],
  ['group-totals', 'database', 'Count and sum by region', 'Database'],
  ['group-totals', 'array', 'Count and sum by region', 'Raw DataView on a resident JS array'],
];
export const directoryOperations = [
  ['reopen', 'get-close', 'Reopen a directory', 'Open, read one stored event and close'],
];
export const operationsFor = (backend) => [
  ...operations,
  ...(backend === 'memory' ? memoryQueries : directoryOperations),
];
export const cardKeys = [
  ['search', 'lexical', 'Full-text search', 'BM25 on indexed terms'],
  ['search', 'vector', 'Vector search', 'Exact cosine similarity'],
  ['search', 'hybrid', 'Hybrid search', 'Combine text and vector rankings'],
];
export const lookup = (report, backend, workload, path) =>
  report.results.find(
    (row) => row.backend === backend && row.workload === workload && row.path === path,
  );
/** Published samples must come from the runtimes mise.toml pins, never from a global install. VERIFIED: a recipe once
 * ran Homebrew Bun 1.4.3 through GNU Make 3.81's original PATH. */
export async function assertPinnedRuntime(report) {
  const pins = Object.fromEntries(
    [...(await readFile('mise.toml', 'utf8')).matchAll(/^(\w+)\s*=\s*"([^"]+)"/gm)].map((m) => [
      m[1],
      m[2],
    ]),
  );
  const pinned = report.runtime === 'Bun' ? pins.bun : 'v' + pins.node;
  assert.equal(
    report.runtimeVersion,
    pinned,
    `${report.runtime} samples must come from the pinned ${pinned}`,
  );
}
/**
 * True while the CHANGELOG's newest entry is `## Unreleased`. Main then keeps the last release's version and its
 * measured evidence, while dependency pins may move ahead; the next release measures again. This avoids publishing
 * numbers measured mid-development on a shared, loaded host. VERIFIED: human decision 2026-11-21.
 */
export async function unreleased() {
  return /^## Unreleased\b/.test(
    ((await readFile('CHANGELOG.md', 'utf8')).match(/^## .*$/m) ?? [''])[0],
  );
}
export async function loadReports(directory) {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const between = await unreleased();
  return Promise.all(
    ['Node', 'Bun'].map(async (runtime) => {
      const report = JSON.parse(
        await readFile(directory + '/workloads-' + runtime.toLowerCase() + '.json', 'utf8'),
      );
      assert.equal(report.runtime, runtime);
      await assertPinnedRuntime(report);
      assert.equal(report.version, pkg.version);
      if (!between) assert.equal(report.dataviewVersion, pkg.dependencies['defuss-dataview']);
      assert.equal(report.warmups, 2);
      assert.equal(report.repeats, 7);
      assert.equal(report.historyFixture.documents, 256);
      assert.equal(report.historyFixture.initialVersionsPerDocument, 4);
      assert.equal(report.historyFixture.binaryBytesPerDocument, 512);
      assert.deepEqual(report.queryFixture, {
        documents: 4096,
        tenants: 64,
        groups: 16,
        tenantSelected: 7,
        pageSize: 20,
      });
      assert.deepEqual(report.searchFixture, { documents: 256, vectorDimensions: 8, hits: 5 });
      assert.deepEqual(report.writeFixture, { initialDocuments: 4096, batchSize: 64 });
      const scopes = ['memory', 'directory'];
      assert.equal(
        report.results.length,
        scopes.reduce((count, b) => count + operationsFor(b).length, 0),
      );
      for (const backend of scopes) {
        const plans = report.accessPlans[backend];
        assert.equal(plans.ordered.index, 'tenant_score');
        assert.equal(plans.ordered.kind, 'ordered');
        assert.equal(plans.scan.kind, 'scan');
        assert.ok(Number.isSafeInteger(plans.scan.revision) && plans.scan.revision > 0);
        assert.equal(plans.ordered.revision, plans.scan.revision);
        for (const [workload, path] of operationsFor(backend)) {
          const r = lookup(report, backend, workload, path);
          assert.ok(r, runtime + ' ' + backend + ' ' + workload + ' ' + path);
          assert.ok(Number.isSafeInteger(r.iterations) && r.iterations > 0);
          assert.equal(r.samplesMs.length, report.repeats);
          assert.ok(r.samplesMs.every((n) => Number.isFinite(n) && n > 0));
          assert.equal(r.medianMs, [...r.samplesMs].sort((a, b) => a - b)[3]);
          if (
            workload === 'tenant-feed' ||
            workload === 'tenant-top' ||
            workload === 'group-totals'
          ) {
            const selective =
              (workload === 'tenant-top' && path === 'database') ||
              (workload === 'tenant-feed' && path === 'ordered');
            assert.equal(
              r.scannedRows,
              selective ? report.queryFixture.pageSize + 1 : report.queryFixture.documents,
            );
          }
        }
      }
      return report;
    }),
  );
}
