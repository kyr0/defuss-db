import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { loadReports, lookup, cardKeys, operations, formatMs } from './workload-report.mjs';
import { feedCaption } from '../docs/assets/bench-format.js';
import { loadMongoReports, mongoChartData, mongoLookup, mongoOperations } from './mongo-report.mjs';
const root = resolve('docs'),
  paths = await readdir(root, { recursive: true }),
  html = paths.filter((p) => p.endsWith('.html')),
  cache = new Map();
const load = async (path) => {
  if (!cache.has(path)) cache.set(path, await readFile(join(root, path), 'utf8'));
  return cache.get(path);
};
let links = 0;
for (const path of html) {
  const source = await load(path);
  assert(!/@@[A-Z_]+@@/.test(source), 'Unexpanded site token in ' + path);
  for (const [, ref] of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:(?:https?:)?\/\/|mailto:|data:)/.test(ref)) continue;
    const url = new URL(ref, 'https://docs.test/' + path);
    // A folder link serves its index.html, as serve-site.mjs and static hosts do.
    const dest = decodeURIComponent(url.pathname.slice(1)).replace(/(^|\/)$/, '$1index.html');
    assert((await stat(join(root, dest))).isFile(), path + ' → ' + ref);
    if (url.hash && extname(dest) === '.html') {
      const id = decodeURIComponent(url.hash.slice(1)),
        target = await load(dest);
      assert(target.includes('id="' + id + '"'), path + ' → ' + ref);
    }
    links++;
  }
}
const index = await load('index.html'),
  bench = JSON.parse(index.match(/id="bench-data">([^<]+)</)[1]);
const reports = await loadReports('docs/benchmarks');
assert.equal(bench.length, operations.length * 4);
assert.ok(
  bench.every((row) => row.path !== 'array'),
  'Landing page charts accept database paths only',
);
for (const row of bench) {
  const measured = lookup(
    reports.find((r) => r.runtime === row.runtime),
    row.backend,
    row.workload,
    row.path,
  );
  assert.equal(row.medianMs, measured.medianMs);
  assert.equal(row.scannedRows, measured.scannedRows);
}
for (const [key, path] of cardKeys) {
  const measured = lookup(reports[0], 'memory', key, path);
  const card = index.split(
    'class="db-latency" data-workload="' + key + '" data-path="' + path + '"',
  )[1];
  assert(
    card?.split('</div>')[0].includes('<output>' + formatMs(measured.medianMs) + ' ms</output>'),
  );
}
const sample = (workload, path) => lookup(reports[0], 'memory', workload, path);
const caption = feedCaption(
  'Node',
  'memory',
  sample('tenant-feed', 'ordered'),
  sample('tenant-feed', 'scan'),
);
assert(index.includes('id="bench-context" aria-live="polite">' + caption));
assert(index.includes('id="bench-chart" role="img" aria-label="' + caption));
for (const [label, path] of [
  ['indexed', 'ordered'],
  ['plain', 'plain'],
]) {
  assert(
    index.includes(
      'id="insert-' + label + '">' + formatMs(sample('append-events', path).medianMs) + ' ms',
    ),
  );
}
const guide = await load('guides/performance.html');
const memoryTable = guide.split('id="rows-already-in-memory"')[1]?.split('<h2')[0];
assert(
  memoryTable?.includes('Resident DataView array') && !/directory|OPFS/i.test(memoryTable),
  'Array results must appear under memory only',
);
assert(!index.includes('DataView on the same records'));
// The landing page embeds the Ledger playground that scripts/demo-build.mjs writes to docs/demo/.
assert(index.includes('<iframe src="demo/"'));
for (const file of ['demo/index.html', 'demo/app.js', 'demo/worker.js', 'demo/theme.js'])
  assert(paths.includes(file), file + ' missing; run scripts/demo-build.mjs');
for (const path of [...html, 'llms.txt', ...paths.filter((p) => p.endsWith('.md'))].filter(
  (p) => !p.startsWith('assets/vendor/'),
)) {
  const content = (await load(path)).replace(/<svg[\s\S]*?<\/svg>/g, '');
  assert(
    !/(?:benchmark-v[345]|performance-v[345]|read-ratio|oldMs|newMs|v5\.[01]\b|Version [345]\.[012] (?:add|read|use)|v4\.2 measurements)/i.test(
      content,
    ),
    'Release comparison in ' + path,
  );
}
assert(paths.includes('assets/vendor/charts/echarts.min.js'));

assert((await load('guides/history.html')).includes('$asOfRevision'));
// VERIFIED: a Markdown table whose delimiter row does not match its header rendered as raw pipes; none may survive.
for (const path of html.filter((p) => p.startsWith('guides/'))) {
  const text = (await load(path)).replace(/<pre[\s\S]*?<\/pre>/g, '');
  assert(!/^\|.*\|\s*$/m.test(text), 'Unrendered Markdown table in ' + path);
}
// The landing page's MongoDB charts plot exactly the medians of both reports.
const mongoReports = await loadMongoReports('docs/benchmarks');
const mongo = mongoReports.find((r) => r.runtime === 'Node');
const largest = Math.max(...mongo.sizes);
const embedded = index.match(
  /<script type="application\/json" id="mongo-data">([\s\S]*?)<\/script>/,
);
assert(embedded, 'MongoDB chart data missing');
assert.deepEqual(JSON.parse(embedded[1]), mongoChartData(mongoReports), 'MongoDB chart data');
// Each claim of the landing page's comparison paragraph, checked against the medians of both runtimes, because
// the page shows either.
for (const mongo of mongoReports) {
  const ratioAt = (workload) => {
    const [, , systems, reference] = mongoOperations.find(([w]) => w === workload);
    const best = Math.min(
      ...systems.map((system) => mongoLookup(mongo, largest, workload, system).medianMs),
    );
    return best / mongoLookup(mongo, largest, workload, reference).medianMs;
  };
  const gap = (workloads) => workloads.map(ratioAt);
  const about = (r) => r > 1 / 1.5 && r < 1.5;
  assert(
    ratioAt('point-get') < 0.5,
    mongo.runtime + ': defuss-db is no longer clearly faster at reads by ID',
  );
  assert(
    gap(['tenant-feed', 'range-count', 'group-totals']).every((r) => r < 1.5),
    mongo.runtime +
      ': index pages, range counts or the full-scan aggregate no longer take about as long as on MongoDB or less',
  );
  assert(
    about(ratioAt('update-one')) &&
      about(ratioAt('insert-batch')) &&
      ratioAt('update-concurrent') < 1,
    mongo.runtime +
      ': a flushed update or 64-document commit no longer takes about as long as a journaled one, or concurrent updates no longer less',
  );
  const load = ratioAt('bulk-load');
  assert(
    load > 1 &&
      load === Math.max(...mongoOperations.filter(([, , , ref]) => ref).map(([w]) => ratioAt(w))),
    mongo.runtime + ': bulk loads are no longer furthest behind: update the landing page copy',
  );
}
// The scale card's claim: reads by ID and index pages cost about the same at the smallest and largest size.
const smallest = Math.min(...mongo.sizes);
for (const [workload, system] of [
  ['point-get', 'defuss-db'],
  ['tenant-feed', 'defuss-db-index-page'],
]) {
  const growth =
    mongoLookup(mongo, largest, workload, system).medianMs /
    mongoLookup(mongo, smallest, workload, system).medianMs;
  assert(growth < 1.5, workload + ' no longer costs about the same as the collection grows');
}
assert((await load('llms.txt')).includes('workloads-node.json'));
console.log(
  html.length +
    ' HTML pages, ' +
    links +
    ' local references, ' +
    bench.length +
    ' measured series and the Ledger playground verified.',
);
