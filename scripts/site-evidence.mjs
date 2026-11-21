// Publishes measured evidence: copies output/ reports into docs/benchmarks and renders docs/PERFORMANCE.md
// from them. `--check` renders from docs/benchmarks and fails when docs/PERFORMANCE.md differs, so the
// published page can never drift from its raw samples. VERIFIED: rule docs.performance-evidence runs the check mode.
import assert from 'node:assert/strict';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { formatMs, loadReports, lookup, operations, unreleased } from './workload-report.mjs';
import { loadMongoReports, mongoRows } from './mongo-report.mjs';

const check = process.argv.includes('--check');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const { version } = await json('package.json');
let validation;
if (!check) {
  const tests = await json('output/tests.json'),
    e2e = await json('output/e2e-results.json');
  const { total } = await json('output/coverage/coverage-summary.json');
  assert(tests.success && tests.numTotalTests === tests.numPassedTests);
  assert.equal(e2e.package, 'defuss-db@' + version);
  assert(e2e.browser.length && e2e.browser.every((r) => r.ok) && e2e.examples.length);
  validation = {
    version,
    tests: tests.numPassedTests,
    lines: total.lines.pct,
    branches: total.branches.pct,
    browser: e2e.browserVersion,
    browserScenarios: e2e.browser.length,
    browserAssertions: e2e.browser.reduce((sum, r) => sum + r.assertions, 0),
    examples: e2e.examples.length,
  };
  await loadReports('output');
  await loadMongoReports('output');
  for (const kind of ['workloads', 'mongodb'])
    for (const runtime of ['node', 'bun'])
      await copyFile(`output/${kind}-${runtime}.json`, `docs/benchmarks/${kind}-${runtime}.json`);
  await writeFile('docs/benchmarks/validation.json', JSON.stringify(validation, null, 2) + '\n');
}
const all = await loadReports('docs/benchmarks');
const mongo = await loadMongoReports('docs/benchmarks');
const row = (cells) => '| ' + cells.join(' | ') + ' |';
const md = [
  '# Query, search and storage benchmarks',
  '',
  '## A compound index for a tenant feed',
  '',
  'Return the 20 highest-scoring events for one tenant. The collection has 4,096 events, 64 tenants and 64 events per tenant. Both paths query the same collection at the same revision on the same backend. Both return complete event documents in identical order. A JavaScript filter and sort verifies every result outside the timed interval.',
  '',
  'The ordered index stores tenant ascending and score descending. Equality on the first field lets the database seek directly to the tenant. The remaining keys are already in score order, so the reader stops after 20 events and one lookahead. The collection scan reads all events, filters and orders the matches. The query uses the same page size, snapshot acquisition and count mode on both paths. Result caching is disabled. Plans and indexes are prepared before timing.',
  '',
  '| Runtime | Storage for both paths | Compound index (ms) | Collection scan (ms) | Rows examined, index / scan |',
  '| --- | --- | ---: | ---: | ---: |',
];
for (const r of all)
  for (const b of ['memory', 'directory']) {
    const indexed = lookup(r, b, 'tenant-feed', 'ordered'),
      scan = lookup(r, b, 'tenant-feed', 'scan');
    md.push(
      row([
        r.runtime,
        b,
        formatMs(indexed.medianMs),
        formatMs(scan.medianMs),
        indexed.scannedRows + ' / ' + scan.scannedRows,
      ]),
    );
  }
md.push(
  '',
  '### What the index costs on writes',
  '',
  'Each pair commits the same batch of 64 new events to two collections on the same database. Both start with 4,096 identical events and maintain primary keys. One also maintains the tenant–score index. Every round inserts fresh IDs. Each latency covers the full batch and commit. The initial index build is outside these timings.',
  '',
  '| Runtime | Storage for both collections | With compound index (ms) | Primary keys only (ms) |',
  '| --- | --- | ---: | ---: |',
);
for (const r of all)
  for (const b of ['memory', 'directory'])
    md.push(
      row([
        r.runtime,
        b,
        ...['ordered', 'plain'].map((p) => formatMs(lookup(r, b, 'append-events', p).medianMs)),
      ]),
    );

const mongoNode = mongo.find((r) => r.runtime === 'Node');
const sizes = mongoNode.sizes.map((n) => n.toLocaleString('en-US'));
md.push(
  '',
  '## Compared with MongoDB on one machine',
  '',
  `Both systems run on the same machine and hold the same documents: a numeric ID, one of 64 tenants, one of 16 regions, a unique score, a Date and a short label. Both maintain the same compound index on tenant ascending and score descending. defuss-db runs inside the benchmark process on directory storage. MongoDB ${mongoNode.server.version} runs as a standalone ${mongoNode.server.storageEngine} server and is reached over loopback TCP through the official driver ${mongoNode.mongodbDriver}. Each run measures ${sizes.join(' and ')} documents. Every timed result is compared with the other system and with a JavaScript oracle outside the timed interval.`,
  '',
  'A defuss-db write returns after its commit is flushed to the storage device. MongoDB with the default write concern (`w: 1`) acknowledges a write before its journal is flushed. With `j: true` it waits for the journal flush, which makes it the durability match for defuss-db writes. Read operations have no journal column. The last column compares defuss-db reads with MongoDB `w: 1` and defuss-db writes with MongoDB `j: true`.',
  '',
  `Each run measures both systems in the same rounds, back to back and in alternating order, so load from other processes on the host hits both alike: ${mongoNode.repeats} rounds after ${mongoNode.warmups} warmups, and ${mongoNode.fixture.loadRounds} for bulk loads, each into a fresh store and collection. The last column gives the geometric mean of the per-round time ratios with its 95% confidence interval (Student's t on the log ratios). It names a faster or slower system only when the whole interval lies on one side of 1, and reads "no clear difference" otherwise. The interval covers the variation within one run, not between runs on a host under different load.`,
  '',
);
for (const report of mongo) {
  md.push(
    `### ${report.runtime === 'Node' ? 'Node.js' : report.runtime} ${report.runtimeVersion.replace(/^v/, '')}`,
    '',
    '| Operation | Documents | defuss-db median (ms) | MongoDB `w: 1` median (ms) | MongoDB `j: true` median (ms) | defuss-db compared with MongoDB |',
    '| --- | ---: | ---: | ---: | ---: | --- |',
  );
  for (const r of mongoRows(report))
    md.push(
      row([r.label, r.size.toLocaleString('en-US'), r.defuss, r.mongodb, r.journaled, r.ratio]),
    );
  md.push('');
}
const [node, bun] = mongo;
const txn = node.capabilities.mongodbMultiDocumentTransactions;
md.push(
  `The top-20 row lists two defuss-db read paths: the query API first, then \`pageByIndex()\`. The full-scan aggregate row lists one thread first, then ${node.parallel.at(-1).workers} query worker threads (\`openDirectory(path, { parallel: true })\`, with exact sums so the partial results merge). Each comparison uses the faster path.` +
    ' The repeated aggregate reuses the defuss-db result cache, which a later commit to the collection invalidates; MongoDB has no result cache to compare with.',
  '',
  'The defuss-db load includes the background compaction that ran while it loaded. Reads start after the compaction that follows the first load round has finished: ' +
    node.compaction
      .map(
        (c) =>
          `at ${c.size.toLocaleString('en-US')} documents it finished ${(c.settleMs / 1000).toFixed(1)} s after the last commit, after ${c.runs} copies that reclaimed ${Math.round(c.reclaimedBytes / 2 ** 20)} MiB, and left ${Math.round(c.committedBytes / 2 ** 20)} MiB on disk`,
      )
      .join('; ') +
    ' (Node.js).',
  '',
  (() => {
    const largest = Math.max(...node.sizes);
    const w = node.warm.find((entry) => entry.size === largest);
    const mib = (n) => Math.round(n / 2 ** 20);
    return (
      'Reads run on warm caches: before any read is timed, each system scans the whole collection and walks the whole compound index once. ' +
      `At ${largest.toLocaleString('en-US')} documents defuss-db then held ${mib(w.defussCacheBytes)} MiB of decoded tree pages in ${w.defussCachePages.toLocaleString('en-US')} cache entries, including pages of generations that background compaction had replaced; it does not cache document values, which it reads from the file and decodes on every scan. ` +
      (w.mongodbCacheBytes === null
        ? 'MongoDB did not report its cache use.'
        : `MongoDB's WiredTiger cache held ${mib(w.mongodbCacheBytes).toLocaleString('en-US')} MiB of its ${mib(node.server.cacheBytes).toLocaleString('en-US')} MiB limit (Node.js run).`)
    );
  })(),
  '',
  `A 4 KiB write followed by a defuss-storage flush took ${formatMs(node.flushProbe.medianMs)} ms under Node.js and ${formatMs(bun.flushProbe.medianMs)} ms under Bun on the benchmark machine.` +
    (node.platform === 'darwin'
      ? ' On macOS, defuss-storage asks the drive to empty its write cache (`F_FULLFSYNC`) under both runtimes, as MongoDB `j: true` waits for its journal flush.'
      : ''),
  '',
  txn.supported
    ? 'This MongoDB server accepted a multi-document transaction.'
    : `This standalone MongoDB server rejected a multi-document transaction with the error "${txn.error}" defuss-db committed two collections in one transaction on the same directory storage.`,
  '',
  '## Ranked search',
  '',
  'Search returns five ranked documents from 256 articles. Full-text search uses BM25. Vector search uses exact cosine similarity on supplied eight-dimensional embeddings. Hybrid search combines both signals. All three timings include document lookup with a warm search engine. The first search after reopening rebuilds its engine from stored inputs and has a separate cost. [Search indexes](SEARCH.md)',
  '',
);
function operationTable(entries) {
  md.push(
    '| Operation | Path | Node memory (ms) | Node directory (ms) | Bun memory (ms) | Bun directory (ms) |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
  );
  for (const [key, path, title, note] of entries) {
    const values = all.flatMap((r) =>
      ['memory', 'directory'].map((b) => formatMs(lookup(r, b, key, path).medianMs)),
    );
    md.push(row([title, note, ...values]));
  }
}
operationTable(operations.filter(([key]) => key === 'search'));
md.push(
  '',
  '## Reopen a file-backed database',
  '',
  'Each sample opens an existing database from its Node or Bun directory, reads a known event by ID and closes the handle. All earlier handles are already closed. The process stays alive and the OS filesystem cache is warm. The browser playground demonstrates persistence separately through OPFS in a dedicated worker.',
  '',
  '| Runtime | Directory open + read + close (ms) |',
  '| --- | ---: |',
);
for (const r of all)
  md.push(row([r.runtime, formatMs(lookup(r, 'directory', 'reopen', 'get-close').medianMs)]));
md.push(
  '',
  '## Document reads, history and writes',
  '',
  'The temporal fixture starts with 256 documents, four effective versions per ID and a 512-byte binary field. Current writes commit one document. Backdated edits change a closed interval. A cold historical page builds index postings for its slice. A warm page reuses those postings. The OS cache is warm in both cases. Live ordered pages use the 4,096-event fixture.',
  '',
);
operationTable(
  operations.filter(([key]) => !['search', 'tenant-feed', 'append-events'].includes(key)),
);
md.push(
  '',
  '## Rows already in memory',
  '',
  'For an application that already owns its decoded objects and needs a projection or aggregate, raw DataView can query the array directly. Use the database when the collection also needs maintained indexes, atomic edits, pinned reads, ranked search or history.',
  '',
  'This memory-only experiment runs the same prepared DataView projection or aggregate over 4,096 records in one process. One source is an immutable resident JavaScript array. The other is an in-memory defuss-db collection with encoded documents and snapshot reads. Both return identical fields, groups and ordering. Result caching is disabled. The projected page returns ID and score for one tenant. The aggregate counts all events and sums scores for 16 regions. Record creation and loading are excluded.',
  '',
  '| Runtime | Query | In-memory defuss-db (ms) | Resident DataView array (ms) | Rows examined, DB / array |',
  '| --- | --- | ---: | ---: | ---: |',
);
for (const r of all)
  for (const [key, label] of [
    ['tenant-top', 'Top 20 projected scores'],
    ['group-totals', 'Count and sum by region'],
  ]) {
    const db = lookup(r, 'memory', key, 'database'),
      array = lookup(r, 'memory', key, 'array');
    md.push(
      row([
        r.runtime,
        label,
        formatMs(db.medianMs),
        formatMs(array.medianMs),
        db.scannedRows + ' / ' + array.scannedRows,
      ]),
    );
  }
md.push(
  '',
  '## Reproduce the measurements',
  '',
  'Run `make bench-workloads` for the defuss-db workloads and `make bench-mongo` for the MongoDB comparison; the latter reads `MONGODB_URL`, creates a throwaway database and drops it afterwards. Values are medians of seven samples after two warmups. Each series starts once background compaction from earlier writes has finished; in the MongoDB comparison, the collection load includes it. Paired paths alternate order. Each runtime runs separately, one client at a time, except for the 32 concurrent writers. Timings are milliseconds per operation. For repeated point reads and single-document writes, each sample is elapsed time divided by its call count. A collection load is measured once. The JSON records every sample, iteration count and selected query plan.',
  '',
  ...all.map((r) => `- ${r.runtime} ${r.runtimeVersion} on ${r.platform} ${r.arch}, ${r.cpu}.`),
  `- defuss-db ${all[0].version} with defuss-dataview ${all[0].dataviewVersion}.${(await unreleased()) ? ' Main has unreleased changes since; the next release measures again.' : ''}`,
  `- MongoDB ${mongoNode.server.version} (${mongoNode.server.storageEngine}, standalone: ${mongoNode.server.replicaSet ? 'no' : 'yes'}) on the same machine.`,
  `- One-minute host load average during the MongoDB comparison (Node.js): ${mongoNode.loadAverage[0].toFixed(1)} at the start and ${mongoNode.loadAverageEnd[0].toFixed(1)} at the end, on ${mongoNode.cpuCount} cores; other processes on the host share them.`,
  '',
  '[Node samples](benchmarks/workloads-node.json) · [Bun samples](benchmarks/workloads-bun.json) · [MongoDB comparison, Node](benchmarks/mongodb-node.json) · [MongoDB comparison, Bun](benchmarks/mongodb-bun.json)',
  '',
);
const page = md.join('\n');
if (check) {
  const published = await readFile('docs/PERFORMANCE.md', 'utf8');
  if (published !== page) {
    console.error(
      'docs/PERFORMANCE.md differs from docs/benchmarks/*.json; run `node scripts/site-evidence.mjs` after `make verify bench-workloads bench-mongo`.',
    );
    process.exit(1);
  }
  console.log('docs/PERFORMANCE.md matches docs/benchmarks/*.json');
} else {
  await writeFile('docs/PERFORMANCE.md', page);
  const path = 'docs/VALIDATION.md';
  const text = (await readFile(path, 'utf8'))
    .replace(/\d+ tests using real memory/, validation.tests + ' tests using real memory')
    .replace(
      /The final run measured [\d.]+% line coverage and [\d.]+% branch coverage/,
      `The final run measured ${validation.lines}% line coverage and ${validation.branches}% branch coverage`,
    )
    .replace(
      /Real Chromium Headless Shell [^|\n]+/,
      `Real Chromium Headless Shell ${validation.browser}, dedicated workers and OPFS. ${validation.browserScenarios} scenarios with ${validation.browserAssertions} assertions `,
    )
    .replace(
      /^\| Browser examples \| \d+ Chromium checks run seven examples against the installed tarball\./m,
      `| Browser examples | ${validation.examples} Chromium checks run seven examples against the installed tarball.`,
    );
  await writeFile(path, text);
}
