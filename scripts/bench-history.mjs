import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { cpus, loadavg, tmpdir } from 'node:os';
import { join } from 'node:path';
import { forRows } from 'defuss-dataview/compute';
import { createImmutableArraySource } from 'defuss-dataview/stream';
import { openMemory } from '../dist/index.mjs';
import { openDirectory } from '../dist/server.mjs';

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const runtime = process.versions.bun ? 'Bun' : 'Node';
const report = {
  version: pkg.version,
  dataviewVersion: pkg.dependencies['defuss-dataview'],
  runtime,
  runtimeVersion: process.versions.bun ?? process.version,
  recordedAt: new Date().toISOString(),
  cpu: cpus()[0].model,
  platform: process.platform,
  arch: process.arch,
  repeats: 7,
  warmups: 2,
  historyFixture: { documents: 256, initialVersionsPerDocument: 4, binaryBytesPerDocument: 512 },
  queryFixture: { documents: 4096, tenants: 64, groups: 16, tenantSelected: 7, pageSize: 20 },
  searchFixture: { documents: 256, vectorDimensions: 8, hits: 5 },
  writeFixture: { initialDocuments: 4096, batchSize: 64 },
  accessPlans: {},
  results: [],
};
// Other processes on the host change every timing; the report keeps the load average around the run.
const loadAtStart = loadavg();
const temp = await mkdtemp(join(tmpdir(), 'defuss-db-measure-'));
const median = (samples) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];

// Each series has its own operation and oracle. Validation and cache preparation are untimed.
// Alternate order for paired paths. Samples retain mean latency per call within a repetition.
// VERIFIED: background compaction started by seeding or an earlier series would overlap the next samples, so
// it finishes before the next series is timed.
const measured = new Set();
async function settled() {
  for (const db of measured)
    for (;;) {
      const [state, workers] = await db.stats().then(
        (stats) => [stats.autoCompaction.state, stats.parallel?.state],
        // The reopen series closes its databases; a closed database has nothing left to compact.
        (error) => (error.code === 'CLOSED' ? ['off'] : Promise.reject(error)),
      );
      // Directory stores start query workers on their first eligible aggregate; time them once they run.
      if (state !== 'running' && state !== 'waiting' && workers !== 'starting') break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
}
async function measure(backend, workload, variants, iterations = 1) {
  await settled();
  const observations = variants.map(() => []);
  for (let round = -report.warmups; round < report.repeats; round++) {
    if (round === 0) await settled();
    const indices = variants.map((_, i) => i);
    if (round % 2) indices.reverse();
    for (const i of indices) {
      const v = variants[i];
      await v.before?.();
      const outputs = Array.from({ length: iterations });
      const start = performance.now();
      for (let n = 0; n < iterations; n++) outputs[n] = await v.run(n);
      const elapsed = (performance.now() - start) / iterations;
      for (let n = 0; n < iterations; n++) v.check(outputs[n], n);
      if (round >= 0) observations[i].push(elapsed);
    }
  }
  for (const [i, v] of variants.entries()) {
    const samplesMs = observations[i];
    report.results.push({
      backend,
      workload,
      path: v.path,
      ...(v.scannedRows === undefined ? {} : { scannedRows: v.scannedRows }),
      iterations,
      medianMs: median(samplesMs),
      samplesMs,
    });
  }
}
const at = (ms) => new Date(ms);
async function temporal(backend, currentDb, historyDb) {
  const { documents, binaryBytesPerDocument } = report.historyFixture;
  const current = currentDb.collection('items');
  const tracked = await historyDb.ensureCollection('items', { $trackHistory: true });
  const payload = new Uint8Array(binaryBytesPerDocument).fill(91);
  const docs = (level) =>
    Array.from({ length: documents }, (_, id) => ({ id, score: id, level, payload }));
  await current.insertMany(docs(4));
  let firstRevision;
  for (let level = 1; level <= 4; level++) {
    const values = docs(level);
    for (let start = 0; start < documents; start += 64) {
      await historyDb.transaction(async (tx) => {
        const c = tx.collection('items').at(at(level * 100));
        for (const row of values.slice(start, start + 64)) await c.put(row);
      });
    }
    if (level === 1) firstRevision = (await historyDb.stats()).revision;
  }
  for (const c of [current, tracked])
    await c.createIndex({ name: 'score', fields: ['score'], order: ['asc'] });
  const selected = tracked.at(at(150)),
    recorded = tracked.at(at(150), { $asOfRevision: firstRevision });
  const point = (path, c, level) => ({
    path,
    run: (n) => c.get((n * 53) % documents),
    check: (d, n) => {
      assert.equal(d.id, (n * 53) % documents);
      assert.equal(d.level, level);
    },
  });
  await measure(
    backend,
    'live-get',
    [point('untracked', current, 4), point('tracked', tracked, 4)],
    32,
  );
  await measure(
    backend,
    'past-get',
    [point('effective', selected, 1), point('as-recorded', recorded, 1)],
    24,
  );
  const changed = (ok) => assert.equal(ok, true);
  const update = (path, c) => ({ path, run: (n) => c.update(n, { tag: 7 }), check: changed });
  await measure(
    backend,
    'live-update',
    [update('untracked', current), update('tracked', tracked)],
    3,
  );
  const countOptions = { cache: false };
  const countPlan = selected.prepareAggregate({ measures: { n: selected.q.count() } });
  const count = (path, options) => ({
    path,
    run: () => countPlan.evaluate(undefined, options),
    check: (r) => assert.equal(r.rows[0].n, documents),
  });
  const cached = count('cached-result', { cache: true });
  await cached.run();
  await cached.run();
  await measure(backend, 'past-count', [count('scan', countOptions), cached]);
  const page = () => selected.pageIdsByIndex('score', { limit: 32 });
  const checkPage = (r) =>
    assert.deepEqual(
      r.rows,
      Array.from({ length: 32 }, (_, i) => i),
    );
  await measure(backend, 'past-id-page', [
    { path: 'cold-index', before: () => historyDb.clearQueryCache(), run: page, check: checkPage },
    { path: 'warm-index', before: page, run: page, check: checkPage },
  ]);
  await measure(backend, 'past-correct', [update('tracked', selected)], 3);
  // Different IDs on each measured round keep the input interval present for every deletion.
  let id = 64;
  await measure(
    backend,
    'past-delete',
    [{ path: 'tracked', run: () => selected.delete(id++), check: changed }],
    3,
  );
  assert.equal((await tracked.get(64)).level, 4);
  assert.equal(await selected.has(64), false);
  assert.equal((await recorded.get(64)).level, 1);
  await historyDb.verify();
}
async function query(backend, db) {
  const f = report.queryFixture,
    c = db.collection('events'),
    q = forRows();
  const rows = Array.from({ length: f.documents }, (_, id) => ({
    id,
    tenant: id % f.tenants,
    region: id % f.groups,
    score: (id * 73) % f.documents,
  }));
  const definition = {
    name: 'tenant_score',
    fields: ['tenant', 'score'],
    order: ['asc', 'desc'],
  };
  await c.createIndex(definition);
  for (let offset = 0; offset < rows.length; offset += 256)
    await c.insertMany(rows.slice(offset, offset + 256));
  const top = {
    filters: [{ field: 'tenant', op: 'eq', value: f.tenantSelected }],
    select: { id: q.field('id'), score: q.field('score') },
    orderBy: [{ expr: q.field('score'), direction: 'desc' }],
  };
  const groups = {
    groupBy: { region: q.field('region') },
    measures: { count: q.count(), score: q.sum(q.field('score')) },
    orderBy: [{ field: 'region', direction: 'asc' }],
  };
  const page = { limit: f.pageSize };
  const expectedDocs = rows
    .filter((r) => r.tenant === f.tenantSelected)
    .sort((a, b) => b.score - a.score)
    .slice(0, page.limit);
  const expectedTop = expectedDocs.map(({ id, score }) => ({ id, score }));
  const request = { filters: top.filters, sorters: [{ field: 'score', direction: 'desc' }] };
  const options = { cache: false, count: 'none' };

  // Both paths open a snapshot in the same unmodified store and return complete documents.
  const plans = {};
  const variants = [];
  for (const path of ['ordered', 'scan']) {
    const selection = path === 'scan' ? { ...request, access: 'scan' } : request;
    const { access, revision } = await c.explain(selection);
    assert.equal(access.kind, path);
    if (path === 'ordered') assert.equal(access.index, definition.name);
    plans[path] = { ...access, revision };
    const plan = c.prepareFind(selection);
    const scannedRows = path === 'ordered' ? f.pageSize + 1 : f.documents;
    variants.push({
      path,
      scannedRows,
      run: () => plan.evaluate(page, options),
      check(result) {
        assert.deepEqual(result.rows, expectedDocs);
        assert.equal(result.summary.scannedRows, scannedRows);
      },
    });
  }
  assert.equal(plans.ordered.revision, plans.scan.revision);
  report.accessPlans[backend] = plans;
  await measure(backend, 'tenant-feed', variants);

  // The standalone array is a memory-only workload. Never open it for a file backend.
  if (backend === 'memory') {
    const source = createImmutableArraySource(rows);
    const expectedGroups = Array.from({ length: f.groups }, (_, region) => ({
      region,
      count: 0,
      score: 0,
    }));
    for (const row of rows) {
      expectedGroups[row.region].count++;
      expectedGroups[row.region].score += row.score;
    }
    for (const [workload, dbPlan, rawPlan, window, expected] of [
      ['tenant-top', c.prepareSelect(top), q.rows(top), page, expectedTop],
      ['group-totals', c.prepareAggregate(groups), q.aggregate(groups), undefined, expectedGroups],
    ]) {
      const paths = [
        { path: 'database', run: () => dbPlan.evaluate(window, options) },
        { path: 'array', run: () => rawPlan.evaluate(source, window, { count: 'none' }) },
      ];
      await measure(
        backend,
        workload,
        paths.map((variant) => {
          const scannedRows =
            workload === 'tenant-top' && variant.path === 'database' ? f.pageSize + 1 : f.documents;
          return {
            ...variant,
            scannedRows,
            check(result) {
              assert.deepEqual(result.rows, expected);
              assert.equal(result.summary.scannedRows, scannedRows);
            },
          };
        }),
      );
    }
  }
  const bounds = { prefix: [f.tenantSelected], limit: f.pageSize };
  const ids = expectedTop.map((row) => row.id);
  await measure(backend, 'ordered-page', [
    {
      path: 'ids',
      run: () => c.pageIdsByIndex('tenant_score', bounds),
      check: (r) => assert.deepEqual(r.rows, ids),
    },
    {
      path: 'documents',
      run: () => c.pageByIndex('tenant_score', bounds),
      check: (r) =>
        assert.deepEqual(
          r.rows.map((row) => row.id),
          ids,
        ),
    },
  ]);
  await measure(backend, 'range-count', [
    {
      path: 'index',
      run: () => c.countByIndex('tenant_score', { prefix: bounds.prefix }),
      check: (n) => assert.equal(n, f.documents / f.tenants),
    },
  ]);

  // Distinct but identically seeded collections. Each pair commits the same 64 new documents.
  const control = db.collection('plain_events');
  for (let offset = 0; offset < rows.length; offset += 256)
    await control.insertMany(rows.slice(offset, offset + 256));
  const batch = report.writeFixture.batchSize;
  const batches = Array.from({ length: report.warmups + report.repeats }, (_, round) =>
    Array.from({ length: batch }, (_, j) => {
      const id = rows.length + round * batch + j;
      return { id, tenant: id % f.tenants, region: id % f.groups, score: (id * 73) % f.documents };
    }),
  );
  await measure(
    backend,
    'append-events',
    [
      [c, 'ordered'],
      [control, 'plain'],
    ].map(([collection, path]) => {
      let round = 0;
      return {
        path,
        run: () => collection.insertMany(batches[round]),
        check(ids) {
          assert.deepEqual(
            ids,
            batches[round].map((row) => row.id),
          );
          round++;
        },
      };
    }),
  );
  for (const collection of [c, control])
    assert.deepEqual(await collection.get(batches.at(-1).at(-1).id), batches.at(-1).at(-1));
}

async function ranking(backend, db) {
  const f = report.searchFixture,
    c = db.collection('articles');
  const signal = (i) =>
    Array.from({ length: f.vectorDimensions }, (_, j) => Math.cos(i * 0.037 * (j + 1)));
  const rows = Array.from({ length: f.documents }, (_, id) => ({
    id,
    text: id % 3 === 0 ? 'amber quartz mineral' : 'green feldspar mineral',
    embedding: signal(id),
  }));
  await c.insertMany(rows);
  const text = { fields: { text: { path: 'text' } } },
    vector = { path: 'embedding', dimensions: f.vectorDimensions };
  for (const def of [
    { name: 'words', kind: 'lexical', text },
    { name: 'similar', kind: 'vector', vector },
    { name: 'combined', kind: 'hybrid', text, vector },
  ]) {
    await c.createSearchIndex(def);
    const query = def.kind === 'lexical' ? 'quartz' : { text: 'quartz', vector: signal(3) };
    const run = () => c.search(def.name, query, { limit: f.hits });
    const reference = (await run()).hits.map((hit) => [hit.id, hit.score]);
    assert.equal(reference.length, f.hits);
    await measure(backend, 'search', [
      {
        path: def.kind,
        run,
        check: (r) => {
          assert.equal(r.cacheHit, true);
          assert.deepEqual(
            r.hits.map((hit) => [hit.document.id, hit.score]),
            reference,
          );
        },
      },
    ]);
  }
}
try {
  for (const backend of ['memory', 'directory']) {
    const open = (name) => (backend === 'memory' ? openMemory() : openDirectory(join(temp, name)));
    const current = await open('current'),
      tracked = await open('tracked');
    measured.clear();
    measured.add(current).add(tracked);
    try {
      await temporal(backend, current, tracked);
      await query(backend, current);
      await ranking(backend, current);
    } finally {
      await Promise.all([current.close(), tracked.close()]);
    }
    if (backend === 'directory') {
      await measure(backend, 'reopen', [
        {
          path: 'get-close',
          async run() {
            const reopened = await open('current');
            try {
              return await reopened.collection('events').get(7);
            } finally {
              await reopened.close();
            }
          },
          check: (doc) => assert.deepEqual(doc, { id: 7, tenant: 7, region: 7, score: 511 }),
        },
      ]);
    }
  }
  await mkdir('output', { recursive: true });
  const path = 'output/workloads-' + runtime.toLowerCase() + '.json';
  report.loadAverage = { start: loadAtStart, end: loadavg() };
  await writeFile(path, JSON.stringify(report, null, 2) + '\n');
  console.log(path, report.results.length + ' measured series');
} finally {
  await rm(temp, { recursive: true, force: true });
}
