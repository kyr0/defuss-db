import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, mkdir, rm, cp } from 'node:fs/promises';
import { basename, dirname, relative, resolve, posix } from 'node:path';
import { marked } from 'marked';
import { feedCaption } from '../docs/assets/bench-format.js';
import { loadReports, lookup, operations, cardKeys, formatMs } from './workload-report.mjs';
import { loadMongoReports, mongoChartData } from './mongo-report.mjs';

const read = (path) => readFile(path, 'utf8');
const json = async (path) => JSON.parse(await read(path));
const escape = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const { version } = await json('package.json');
// Code examples are files in website/examples, typechecked by `make lint`, highlighted here at build time.
const TS_TOKENS =
  /(\/\/.*)|('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(import|from|const|let|await|async|new|try|finally|interface|type|export|return|true|false|null)\b/g;
function highlight(line, lang) {
  if (lang === 'sh') {
    if (line.startsWith('#')) return `<span class="c">${escape(line)}</span>`;
    const [command, ...rest] = line.split(' ');
    return (
      `<span class="k">${escape(command)}</span>` + escape(rest.length ? ' ' + rest.join(' ') : '')
    );
  }
  let out = '',
    last = 0;
  for (const match of line.matchAll(TS_TOKENS)) {
    const kind = match[1] ? 'c' : match[2] ? 's' : 'k';
    out +=
      escape(line.slice(last, match.index)) + `<span class="${kind}">${escape(match[0])}</span>`;
    last = match.index + match[0].length;
  }
  return out + escape(line.slice(last));
}
async function example(name) {
  const lang = name.endsWith('.sh') ? 'sh' : 'ts';
  const lines = (await read('website/examples/' + name)).trimEnd().split('\n');
  return { lang, lines: lines.map((line) => highlight(line, lang)) };
}
/**
 * Variants of one example, named `<base>.<variant>.ts` (orders.browser.ts, orders.server.ts, orders.memory.ts), must
 * align line by line and differ in at most two lines, the import and the line that opens the database, as the hero
 * caption says. Returns, per file, the line indexes where its group differs, which the window highlights.
 */
async function variantLines(names) {
  const groups = Map.groupBy(
    names.filter((name) => name.split('.').length === 3),
    (name) => name.split('.')[0],
  );
  const differing = new Map();
  for (const [base, members] of groups) {
    const texts = await Promise.all(
      members.map(async (name) => (await read('website/examples/' + name)).trimEnd().split('\n')),
    );
    assert(
      texts.every((lines) => lines.length === texts[0].length),
      `${base} variants must align line by line`,
    );
    const at = new Set(texts[0].flatMap((line, i) => (texts.some((t) => t[i] !== line) ? [i] : [])));
    assert(at.size <= 2, `${base} variants may differ only in the import and the open line`);
    for (const name of members) differing.set(name, at);
  }
  return differing;
}
/** @@CODE:file@@ becomes the per-line markup of a mockup-code window; @@SNIPPET:file@@ a highlighted block. */
async function withExamples(html) {
  const tokens = [...html.matchAll(/@@(CODE|SNIPPET):([\w.-]+)@@/g)];
  const differing = await variantLines(tokens.filter(([, kind]) => kind === 'CODE').map(([, , name]) => name));
  for (const [token, kind, name] of tokens) {
    const { lines } = await example(name);
    const marked = differing.get(name) ?? new Set();
    html = html.replace(
      token,
      kind === 'CODE'
        ? lines
            .map((line, i) => `<pre${marked.has(i) ? ' class="db-diff"' : ''}><code>${line}</code></pre>`)
            .join('\n')
        : '<pre class="db-snippet"><code>' + lines.join('\n') + '</code></pre>',
    );
  }
  return html;
}
const reports = await loadReports('docs/benchmarks');
const rows = reports.flatMap((report) =>
  report.results
    .filter((r) => operations.some(([key, path]) => key === r.workload && path === r.path))
    .map(({ backend, workload, path, medianMs, scannedRows }) => ({
      runtime: report.runtime,
      backend,
      workload,
      path,
      medianMs,
      scannedRows,
    })),
);
const initial = reports[0];
const cards = cardKeys
  .map(([key, path, label, note]) => {
    const r = lookup(initial, 'memory', key, path);
    return `<div class="db-latency" data-workload="${key}" data-path="${path}"><span>${escape(label)}</span><output>${formatMs(r.medianMs)} ms</output><small>${escape(note)}</small></div>`;
  })
  .join('\n');
const table =
  '<table><caption>Median milliseconds per operation</caption><thead><tr><th scope="col">Operation</th><th scope="col">Path</th><th scope="col">Node memory</th><th scope="col">Node directory</th><th scope="col">Bun memory</th><th scope="col">Bun directory</th></tr></thead><tbody>' +
  operations
    .map(([key, path, label, note]) => {
      const values = reports.flatMap((r) =>
        ['memory', 'directory'].map((b) => formatMs(lookup(r, b, key, path).medianMs)),
      );
      return (
        '<tr><th scope="row">' +
        escape(label) +
        '</th><td>' +
        escape(note) +
        '</td>' +
        values.map((v) => '<td>' + v + '</td>').join('') +
        '</tr>'
      );
    })
    .join('') +
  '</tbody></table>';
const context = feedCaption(
  initial.runtime,
  'memory',
  lookup(initial, 'memory', 'tenant-feed', 'ordered'),
  lookup(initial, 'memory', 'tenant-feed', 'scan'),
);
// MongoDB comparison charts plot docs/benchmarks/mongodb-*.json. VERIFIED: both runtimes flush the drive cache per
// commit (flushProbe), so both compare with MongoDB j: true.
const mongoReports = await loadMongoReports('docs/benchmarks');
const mongo = mongoReports.find((r) => r.runtime === 'Node');
// Reports measured on an earlier release name it (scripts/workload-report.mjs measuredEarlier).
// VERIFIED: docs/index.html for 3.1.0 says the numbers were measured with defuss-db 3.0.0.
const release = (r) =>
  r.version === version
    ? ''
    : `Measured with defuss-db ${escape(r.version)}${r.dataviewVersion ? ` and defuss-dataview ${escape(r.dataviewVersion)}` : ''}; ${escape(version)} has not been measured again. `;
const mongoContext = `${release(mongo)}Measured on ${escape(mongo.cpu)} (${escape(mongo.platform)} ${escape(mongo.arch)}) against MongoDB ${escape(mongo.server.version)}, a standalone ${escape(mongo.server.storageEngine)} server on the same machine, through driver ${escape(mongo.mongodbDriver)}. Reads run on warm caches; median of seven samples after two warmups; the collection load is a single run.`;
const template = await withExamples(await read('website/index.html'));
await writeFile(
  'docs/index.html',
  template
    .replace('@@BENCH_JSON@@', JSON.stringify(rows))
    .replace('@@BENCH_CARDS@@', cards)
    .replace('@@BENCH_TABLE@@', table)
    .replaceAll('@@BENCH_CONTEXT@@', context)
    .replace(
      '@@INDEXED_INSERT@@',
      formatMs(lookup(initial, 'memory', 'append-events', 'ordered').medianMs) + ' ms',
    )
    .replace(
      '@@PLAIN_INSERT@@',
      formatMs(lookup(initial, 'memory', 'append-events', 'plain').medianMs) + ' ms',
    )
    .replace(
      '@@MONGO_JSON@@',
      JSON.stringify(mongoChartData(mongoReports)).replaceAll('<', '\\u003c'),
    )
    .replace('@@MONGO_CONTEXT@@', mongoContext)
    .replace('@@BENCH_RELEASE@@', release(initial))
    .replaceAll('@@VERSION@@', version),
);
await rm('docs/guides', { recursive: true, force: true });
await mkdir('docs/guides', { recursive: true });
const guides = new Map([
  ['README.md', 'readme'],
  ['ARCH.md', 'architecture'],
]);
for (const name of (await readdir('docs')).filter((n) => n.endsWith('.md')))
  guides.set('docs/' + name, basename(name, '.md').toLowerCase());
const examples = new Set();
function publishedLink(href, source) {
  if (/^[a-z]+:|^\/\/|^#/.test(href)) return href;
  const [file, fragment] = href.split('#');
  const path = relative('.', resolve(dirname(source), file));
  if (guides.has(path)) return guides.get(path) + '.html' + (fragment ? '#' + fragment : '');
  if (path.startsWith('examples/')) {
    examples.add(path);
    return '../' + path;
  }
  if (path.startsWith('docs/')) return '../' + path.slice(5) + (fragment ? '#' + fragment : '');
  throw Error('No published target for ' + href + ' in ' + source);
}
for (const [source, slug] of guides) {
  const ids = new Set();
  const md = await read(source);
  const content = (await marked.parse(md, { gfm: true }))
    .replace(/href="([^"]+)"/g, (_, href) => 'href="' + publishedLink(href, source) + '"')
    .replace(/<h([1-6])>(.*?)<\/h\1>/gs, (_, n, h) => {
      const base =
        h
          .replace(/<[^>]+>/g, '')
          .toLowerCase()
          .replace(/&amp;/g, '')
          .replace(/[^\p{L}\p{N}\s_-]/gu, '')
          .trim()
          .replace(/\s+/g, '-') || 'section';
      let id = base,
        i = 0;
      while (ids.has(id)) id = base + '-' + ++i;
      ids.add(id);
      return `<h${n} id="${id}">${h}</h${n}>`;
    })
    .replace(
      /<pre><code class="language-mermaid">[\s\S]*?<\/code><\/pre>/g,
      '<figure><img src="../assets/architecture.svg" alt="The database sends queries to DataView and storage transactions to DBSONL. DBSONL uses DSON and Storage in memory, server directories or browser OPFS."></figure>',
    );
  const title = (md.match(/^#\s+(.+)$/m)?.[1] ?? slug).replaceAll('**', '');
  const nav =
    '<nav aria-label="Documentation" class="db-guide-nav"><a href="../index.html">← defuss-db</a><a href="../application/app-api-docs.html">API reference</a><a href="../index.html#install">Install</a></nav>';
  await writeFile(
    'docs/guides/' + slug + '.html',
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · defuss-db</title><link rel="icon" href="../favicon.svg"><script src="../assets/theme.js"></script><link rel="stylesheet" href="../assets/vendor/fonts/index.css"><link rel="stylesheet" href="../assets/vendor/defuss-shadcn.css"><link rel="stylesheet" href="../assets/site.css"></head><body><main class="db-guide">${nav}<article>${content}</article>${nav}</main></body></html>\n`,
  );
}
for (const path of examples) {
  await mkdir(dirname('docs/' + path), { recursive: true });
  await cp(path, 'docs/' + path);
}
const links = [...guides.values()]
  .map((slug) => '- [' + slug + '](' + posix.join('guides', slug + '.html') + ')')
  .join('\n');
await writeFile(
  'docs/llms.txt',
  `# defuss-db ${version}

> Embedded TypeScript document database and single-machine alternative to MongoDB. One API for dedicated browser workers (OPFS), Node.js and Bun (directory) and memory. No server, replication, sharding or federation.

Use openMemory() from defuss-db, openDirectory(path) from defuss-db/server, or openOPFS(options) from defuss-db/browser in a dedicated worker. A collection supports typed documents, DataView filters, sorts, projections, grouped aggregates, primary and compound indexes. Search engines accept lexical, vector and hybrid queries. Archives use defuss-brotli and preserve DSON values and indexes. Result caching is automatic for qualifying queries.

Enable persistent document history with db.ensureCollection(name, {$trackHistory:true}). Use collection.at(date) or {$historic:date} for effective-time reads and edits. Add {$asOfRevision:revision} for read-only recorded time. history(id) lists effective segments and audit(id) lists recorded operations. export({history:'full'}) preserves historical facts and source receipts. Read the history guide for activation, corrections, temporal uniqueness, search and restoration.

DataView supplies filtering, sorting, projection, grouping and aggregation. defuss-db adds typed persistent records, atomic transactions, snapshot isolation, B+tree access paths, time slices, ranked search and Brotli backups. The tenant feed benchmark contrasts a compound index with a collection scan on the same backend, returning identical documents. File storage is benchmarked against file storage. The separate resident-array experiment compares raw DataView exclusively with an in-memory database. See the performance guide for write costs, search latency and reopening a directory.

The ordered read API is available on collections, snapshots and transactions. pageIdsByIndex(name,{prefix,limit,after}) returns {rows,nextCursor,revision}. countByIndex(name,{prefix,gte,lt,maxScannedEntries}) returns an exact interval count. Read the ordered index guide for bounds, ties, cursor validity and budgets.

## Documentation

${links}
- [API reference, every function and method with its signature, as Markdown](application/api-docs/llms.txt)

## Distribution and evidence

- [npm package](https://www.npmjs.com/package/defuss-db): \`bun add defuss-db\` or \`npm install defuss-db\`
- [Same-machine MongoDB comparison, compound index and scan, ranked search, persistence and memory-only array measurements](guides/performance.html)
- [MongoDB comparison raw samples, Node.js](benchmarks/mongodb-node.json)
- [MongoDB comparison raw samples, Bun](benchmarks/mongodb-bun.json)
- [Node.js raw samples](benchmarks/workloads-node.json)
- [Bun raw samples](benchmarks/workloads-bun.json)
- [Validation summary](benchmarks/validation.json)
`,
);
console.log('Built landing page and ' + guides.size + ' guides.');
