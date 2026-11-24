# defuss-db 3.3.0

An embedded document database for JavaScript. The same API stores collections in a dedicated browser worker (OPFS), in a Node.js 26+ or Bun 1.4.4+ directory, or in memory. It is an alternative to MongoDB for applications whose data lives on one machine: a transaction commits several collections together, a reader sees one snapshot, and a directory commit returns after it is flushed. defuss-db runs inside your process; it has no server and does not replicate, shard or federate. [Compared with MongoDB](docs/PERFORMANCE.md#compared-with-mongodb-on-one-machine)

It uses **defuss-dataview 0.10.0** for queries, **defuss-dbsonl 0.9.0** for transactions and snapshots, **defuss-storage 0.4.1** for bytes, and **defuss-dson 1.5.1** for native JavaScript values. Use DataView directly when your application owns a resident array and only needs to filter, project or aggregate it. Use defuss-db when the collection must survive a restart, keep compound indexes current across writes, or rank results by full-text, vector or hybrid search. [Search indexes](docs/SEARCH.md) · [Ordered indexes](docs/ORDERED.md)

Enable history per collection. An effective date selects the document that applied then. A recorded revision reproduces what the database knew before a correction. Queries, indexes and search can read the same time slice. [Document history](docs/HISTORY.md)

Compound ordered indexes support seek pagination. Live ID pages and range counts read index entries directly. Equality and ordered filters restrict eligible search hits before ranking. A per-collection cache can reuse compact query results across unrelated writes. Brotli archives carry native values between runtimes. [Operating a store](docs/OPERATIONS.md) · [Measured performance](docs/PERFORMANCE.md)

```sh
bun add defuss-db
# or
npm install defuss-db
```

## Store and query

```ts
import { openDirectory } from 'defuss-db/server';
import type { Document } from 'defuss-db';

interface Order extends Document {
  customer: string;
  country: string;
  amount: number;
  paid: boolean;
  createdAt: Date;
}

const db = await openDirectory('./data', { name: 'shop' });
const orders = db.collection<Order>('orders');
await orders.createIndex({ name: 'country', fields: ['country'] });

await orders.insert({
  customer: 'Ada', country: 'DE', amount: 120, paid: true,
  createdAt: new Date(), // DSON persists a Date, not an ISO string.
});

const result = await orders.query({
  filters: [{ field: 'country', op: 'eq', value: 'DE' }],
  sorters: [{ field: 'amount', direction: 'desc' }],
  limit: 20,
}, { count: 'exact' });
console.log(result.rows, result.summary.totalResultRows);
await db.close();
```

`find()` returns documents. `query()` returns documents and execution metadata. `stream()` yields bounded `batch` events followed by one `complete` event. Use `count: 'exact'` when the query needs an exact pre-pagination total; otherwise an early stop can leave totals `null`.

IDs are strings, finite numbers or bigints; `1`, `1n` and `'1'` differ. An omitted ID generates a UUID string. Numeric-only or literal-ID TypeScript models require an explicit ID. Collections are created lazily by their first write or index declaration.

## Seek through a sorted index

```ts
await orders.createIndex({
  name: 'countryByDate', fields: ['country', 'createdAt'], order: ['asc', 'desc'],
});
const first = await orders.pageByIndex('countryByDate', { prefix: ['DE'], limit: 20 });
if (first.nextCursor) {
  const next = await orders.pageByIndex('countryByDate', {
    prefix: ['DE'], after: first.nextCursor, limit: 20,
  });
  console.log(next.rows);
}
```

For multiple pages of an actively changing collection, use a single database snapshot. Live cursors detect intervening collection writes. The regular query API automatically uses a matching declared index for compatible filters and ordering. [Ordered indexes and cursors](docs/ORDERED.md)

For feeds of IDs, call `pageIdsByIndex` with the same index and options. A count needs only the interval. Both methods also work on pinned snapshots and inside transactions.

```ts
const ids = await orders.pageIdsByIndex('countryByDate', { prefix: ['DE'], limit: 20 });
const count = await orders.countByIndex('countryByDate', {
  prefix: ['DE'], gte: new Date('2026-01-01'), maxScannedEntries: 50_000,
});
console.log(ids.rows, count);
```

## Boolean filters, computed projections and grouping

`collection.q` supplies typed DataView expressions. Ordinary `filters` are ANDed; `where` adds a Boolean expression and can combine `and`, `or`, `not`, comparisons and arithmetic. Dot paths use `q.path('address.city')` and own-property access.

```ts
const q = orders.q;
const rows = await orders.select({
  filters: [{ field: 'customer', op: 'startsWith', value: 'A' }],
  where: q.and(
    q.eq(q.field('paid'), q.literal(true)),
    q.or(q.gt(q.field('amount'), q.literal(100)),
         q.eq(q.field('country'), q.literal('AT'))),
  ),
  select: {
    customer: q.field('customer'),
    gross: q.mul(q.field('amount'), q.literal(1.19)),
  },
  orderBy: [{ expr: q.field('amount'), direction: 'desc' }],
}, { limit: 20 });

const report = await orders.aggregate({
  groupBy: { country: q.field('country') },
  measures: {
    orders: q.count(),
    revenue: q.sum(q.field('amount')),
    mean: q.avg(q.field('amount')),
    paidRevenue: q.sum(q.field('amount'), {
      where: q.eq(q.field('paid'), q.literal(true)),
    }),
  },
  having: [{ field: 'revenue', op: 'gte', value: 100 }],
  orderBy: [{ field: 'revenue', direction: 'desc' }],
});
```

Group keys can bucket and normalize values: `dateTrunc` and `datePart` in UTC or an IANA time zone, `lower`, `upper`, `trim`, `substring`, `concat`, `length`, `cond`, `floor`, `ceil`, `round` and `abs`; `epochMs` turns a Date into milliseconds, so `q.sub(q.epochMs(end), q.epochMs(start))` is a duration. `each` makes one group per distinct array element, as MongoDB's `$unwind`, and must be a whole group key.

```ts
const monthly = await orders.aggregate({
  groupBy: {
    month: q.dateTrunc(q.field('createdAt'), 'month', { timeZone: 'Europe/Berlin' }),
    country: q.lower(q.field('country')), // 'DE' and 'de' are one group
  },
  measures: {
    buyers: q.countDistinct(q.field('customer')),
    median: q.median(q.field('amount')),
    p95: q.percentile(q.field('amount'), 0.95),
  },
  orderBy: [{ field: 'month', direction: 'asc' }],
});
```

Measures: `count`, `sum`, `avg`, `min`, `max`, `sumBigInt`, `countDistinct`, `distinct`, `percentile` and `median`. `count(expr)` excludes null/undefined. Scalar empty-input aggregates return one row (`count = 0`, sums/averages/min/max `null`); grouped empty input returns no rows. Number sums use DataView's compensated arithmetic by default; nonfinite numeric inputs throw unless `invalidNumbers: 'skip'` is explicit.

For a page and totals from the **same snapshot and matching input**, use `view()`:

```ts
const view = await orders.view({
  select: { customer: q.field('customer'), amount: q.field('amount') },
  totals: { revenue: q.sum(q.field('amount')), orders: q.count() },
  orderBy: [{ expr: q.field('amount'), direction: 'desc' }],
}, { offset: 20, limit: 20 });
console.log(view.rows, view.totals);
```

`prepareFind`, `prepareSelect`, `prepareAggregate` and `prepareView` return reusable plans with `evaluate(page?, options?)`, `stream(page?, options?)`, and `explain()`. Each live execution sees a fresh committed snapshot. `collection.source()` exposes documents directly as a DataView `RecordSource` for other DataView plans.

## Streams and memory limits

```ts
for await (const event of orders.stream({
  filters: [{ field: 'paid', op: 'eq', value: true }],
}, { batchSize: 256, maxBatchBytes: 1024 * 1024 })) {
  if (event.type === 'batch') consume(event.rows);
  else console.log(event.summary);
}

// Pull-driven ingestion: each supplied batch is an independent atomic transaction.
for await (const receipt of orders.insertBatches(incomingBatches)) {
  console.log(receipt.ids, receipt.revision);
}
```

Full scans use DataView's native DBSONL batch adapter. No whole collection is loaded merely to start a query. Sorting, top-k candidates, grouping and collected outputs have explicit budgets. Exceeding a budget throws; it does not silently drop rows. Full sort/group spilling to disk is **not implemented**. A streamed grouping must finish its input scan before producing finalized groups.

Ingestion backpressure is per batch. Earlier receipts remain committed if a later batch fails. `insertMany` is instead one bounded atomic transaction. `updateMany` and `deleteMany` collect a bounded target set before applying changes, so updating a queried index cannot change the iterator's candidate set.

## Transactions, indexes and snapshots

```ts
await orders.createIndex({ name: 'customerCountry', fields: ['customer', 'country'], unique: true });

const receipt = await db.transaction(async tx => {
  const pending = tx.collection<Order>('orders');
  const current = await pending.get('order-123');
  if (current) await pending.update(current.id, { paid: true });
  await tx.collection('audit').insert({ id: crypto.randomUUID() });
  return 'recorded';
});

const snapshot = await db.snapshot();
try {
  const stable = snapshot.collection<Order>('orders');
  console.log(await stable.count());
  // All reads through stable use snapshot.revision, even while writers commit.
} finally {
  await snapshot.close();
}
```

All collections, schema records and secondary indexes share one DBSONL commit. Transactions read their own writes. Callbacks run once. Concurrent changes can reject with `CONFLICT`; applications may explicitly retry operations whose side effects are safe to repeat. Await transaction operations sequentially and exhaust/close their streams before returning. An admitted write failure aborts the transaction even if its rejection is caught. No partial transaction is published.

Equality indexes support one or multiple fields. Unique indexes include null and missing values; multiple absent values conflict. Index leaves support primitives, Dates and binary buffers/views, matching DataView value equality. Arrays, plain objects, Maps and Sets are stored normally but are not secondary-index keys. At most 64 indexes per collection; encoded keys must fit DBSONL's 4,096-code-unit limit.

The planner recognizes primary-key equality and short IN lists, complete equality tuples, and ordered indexes with a fixed leading prefix, a range on the next field, or a compatible sort. The complete DataView predicate still runs on candidate documents. `explain()` reports the chosen access path. Use `access: 'scan'` to compare results. [Planner details](docs/ORDERED.md)

Creating/dropping an index is atomic and subject to transaction limits. For large builds, explicitly raise `maxTransactionOperations` and `maxTransactionBytes` when opening the database, or declare indexes before ingesting. No partially built index becomes visible.

## Timestamps, deletion and restore

```ts
import type { Timestamped } from 'defuss-db';

const notes = await db.ensureCollection<Timestamped<{ id: string; text: string }>>('notes', {
  $trackHistory: true,
  $timestamps: true,
});
await notes.insert({ id: 'n1', text: 'draft' });         // _createdAt and _updatedAt: one Date per transaction
await notes.update('n1', { text: 'final' });             // _createdAt stays, _updatedAt advances
await notes.delete('n1');
const [tombstone] = await notes.history('n1');           // { from: Date, until: null, document: undefined }
await notes.restore('n1');                               // the deleted version, as a new version
```

`$timestamps` maintains both fields as Dates, which index, filter, sort and group by calendar like any other Date. In a tracked collection `_updatedAt` equals the `from` of the version each write records. A delete in a tracked collection leaves a tombstone with its effective time, and `restore(id)` brings the deleted version back without hiding deleted documents in every query, as a soft-delete field would. History is kept until you remove it: `pruneHistory({ before })` removes the versions that ended before a date, and `pruneDeleted({ before })` removes deleted documents with every version. [Timestamps](docs/API.md#timestamps), [Deletion and restore](docs/HISTORY.md#deletion-and-restore), [Pruning](docs/HISTORY.md#pruning)

## Full-text, vector and hybrid search

Search uses **defuss-lexicalsearch 0.4.0**, **defuss-vectorsearch 0.4.0** and **defuss-search 0.5.0**. Definitions, projected text/vectors and generation metadata persist atomically with documents on every backend. Queries use the same API on live collections, snapshots and transactions.

```ts
const articles = db.collection('articles');
await articles.createSearchIndex({
  name: 'discovery', kind: 'hybrid',
  text: { fields: { title: { path: 'title', weight: 3, analyzer: 'en' }, body: { path: 'body' } } },
  vector: { path: 'embedding', dimensions: 3, metric: 'cosine' },
});
await articles.put({ id: 'local', title: 'Local databases', body: 'Transactional document search',
  embedding: new Float32Array([1, 0.2, 0.1]), published: true });
const results = await articles.search('discovery', { text: 'local database', vector: [0.9, 0.3, 0.1] }, {
  filter: { filters: [{ field: 'published', op: 'eq', value: true }] },
  limit: 10,
  hybrid: { strategy: 'fusion', lexicalCandidates: 100, vectorCandidates: 100,
    fusion: { method: 'rrf', weights: { lexical: 1, vector: 1 } } },
});
console.log(results.hits.map(hit => [hit.id, hit.score, hit.document]));
```

Declare `kind: 'lexical'` with `text`, or `kind: 'vector'` with `vector`, for individual engines. BM25, phrases, fuzzy/partial/literal queries, 20 language analyzers, exact cosine/dot scoring, optional TurboQuant refinement and hybrid fusion/cascades are supported. Embeddings are supplied by the application. Filtering happens before retrieval top-k. `getMany(ids)` batches point reads in a single snapshot.

The first query of a changed index generation reconstructs its bounded in-memory engine from persisted inputs. Cached queries reuse it; writes changing only unrelated fields preserve that generation. Search is not a disk-resident ANN system. See [search API, lifecycle and limits](docs/SEARCH.md).

## Brotli archives and query caching

```ts
const bytes = await db.export({ quality: 4 });
await emptyTarget.import(bytes); // One atomic import, including rebuilt indexes.
// Streaming: await target.import(source.exportStream()).

const cached = await orders.query({
  filters: [{ field: 'country', op: 'eq', value: 'DE' }], limit: 20,
}); // Automatic caching; cache: false disables it per query.
console.log(cached.rows, db.queryCacheStats());
```

Archives preserve native DSON graphs and collection/index definitions. Buffered and streaming APIs support memory, Node/Bun files and OPFS; limits, cancellation, merge conflicts, and a checksummed frame format are documented in [import/export](docs/ARCHIVE.md). Atomic imports must fit the configured transaction budget. Browser compression needs CSP `script-src 'self' 'wasm-unsafe-eval'`.

Query caching is enabled by default: at least 128 scanned candidates, at most 25% as many output rows, segmented LRU with second-use admission, and bounded byte/count budgets. Tiny primary-key reads bypass its bookkeeping. Set `queryCache: { mode: 'manual' }` when opening to cache only queries that request it, or `queryCache: false` to disable result and plan caching. Keys include the collection's committed version, descriptor, page and resource options. Every hit opens a snapshot, reports its current revision and returns an independent DSON value. Transactions and streams bypass result caching. See [cache configuration and trade-offs](docs/CACHE.md). Updates avoid a redundant document read; integrity audits reuse snapshot-local schemas. Measured costs and limits are in [performance](docs/PERFORMANCE.md).

## MongoDB queries, pipelines and inferred schemas

```ts
import { analyzeSchema } from 'defuss-db';
import { aggregateMongo, findMongo } from 'defuss-db/mongo';

const paid = await findMongo(orders, "{ status: 'paid', amount: { $gt: 100 } }", {
  sort: { createdAt: -1 }, projection: { customer: 1, amount: 1 }, limit: 20,
});
const byCountry = await aggregateMongo(orders, [
  { $match: { status: 'paid' } },
  { $group: { _id: '$country', orders: { $sum: 1 }, revenue: { $sum: '$amount' } } },
  { $sort: { revenue: -1 } },
]); // [{ _id: 'DE', orders: 412, revenue: 81230 }, ...]
const { schema } = await analyzeSchema(orders, { sample: 1000 });
const before = await analyzeSchema(prices, { at: new Date('2026-01-01') }); // a tracked collection
```

`defuss-db/mongo` reads MongoDB's filter, sort and projection documents - as objects, or as text in the shell's syntax (unquoted keys, single quotes, `ISODate()`, `NumberLong()`) or Extended JSON - and translates them into the collection's own request, with MongoDB's rules for null, missing fields, types and arrays (a condition matches an array when one element does; null values sort last): conditions on a top-level field that an index covers become `filters`, which the index answers, the rest one `where` expression. `aggregateMongo` turns a pipeline into one aggregate and answers in MongoDB's shape; a stage that has no place in it (`$lookup`, a `$match` after the `$group`) is refused by name. `analyzeSchema` infers a JSON Schema (draft 2020-12) from a sample spread over the whole collection, or over the collection as it was at a date. See [MongoDB syntax and schemas](docs/API.md#mongodb-syntax-and-schemas).

## Schemas that validate writes

```ts
import { analyzeSchema, validateValue } from 'defuss-db';

const { schema } = await analyzeSchema(events); // a suggestion: type, enum, path and uri
// ... review and correct it, then:
const check = await events.setSchema(schema);
if (check.warning) console.warn(check.warning); // WARNING >= 100 documents of events violate its schema; first: ...
await events.insert({ id: 'ev-1', type: 'scroll' }); // rejects with VALIDATION_FAILED: /type "scroll" is not one of ...
validateValue(schema.properties!.path!, 'a b'); // [{ path: '', keyword: 'format', message: '"a b" is not a valid path' }]
await events.validateCollection({ limit: 100 }); // { checked, invalid, limit, documents, warning? }
await db.collection('_collections').find(); // [{ id: 'events', schema }, ...]
```

A collection validates its writes against a JSON Schema once `setSchema(schema)` sets one: every later insert, replacement and update is checked, and a violating write rejects with a `ValidationError` that names each violated rule by JSON Pointer. Documents the collection already holds stay as they are. `setSchema` answers a bounded check of them with a `warning`, and `validateDocument(id)` and `validateCollection({ limit })` repeat it. `{ validate: false }` on a write stores its documents unchecked, for a bulk import of older data. `validateValue(schema, value)` is the same check without a database, for a form field before it saves. The read-only collection `_collections` holds one entry per collection that `ensureCollection()` or `setSchema()` named.

`analyzeSchema` drafts the schema. For a string field whose sampled values hold no whitespace it suggests a higher-order type: `enum` with the distinct values, `format: 'path'` when a value holds `/`, or `format: 'uri'` when every value is a URL with `://`. A value that ends in two or more digits (`ev-000001`, `s-3558`) or more than 1,000 distinct values rule an enum out, and a document's own `id` is never one. A sample cannot tell a closed set from the values seen so far, so `analyzeSchema` stores and enforces nothing; review its result before you set it. See [Schemas and validation](docs/API.md#schemas-and-validation).

## Node, Bun, browser and memory

| Environment | Factory | Persistence and coordination |
| --- | --- | --- |
| Node.js / Bun | `openDirectory(path, options)` from `defuss-db/server` | defuss-storage files; DBSONL OS locks and directory fsync |
| Browser dedicated worker | `openOPFS(options)` from `defuss-db/browser` | defuss-storage OPFS; origin-scoped Web Locks |
| Any supported runtime | `openMemory(options)` from `defuss-db` | In-memory bytes, same DSON/storage/transaction path |
| Custom coordinated backend | `openDatabase(backend, options)` | Explicit DBSONL Backend contract |

```ts
// Inside a dedicated Worker; HTTPS or localhost is required.
import { openOPFS } from 'defuss-db/browser';
const db = await openOPFS({ namespace: 'my-app', name: 'main' });
await db.collection('settings').put({ id: 'theme', value: 'dark' });
await db.close();
```

OPFS requires a dedicated worker with OPFS sync access handles and Web Locks; it cannot run on the browser main thread. See [worker example](examples/browser-worker.ts). Namespace consistency is mandatory across workers/tabs using the same files. OPFS reports file-level durability because browser APIs expose no directory fsync. Node/Bun's native addon and filesystem requirements are inherited from DBSONL.

`openMemory()` creates an isolated backend. To share one memory store across connections or reopen it, retain `createMemoryBackend()` and pass it to `openDatabase()`.

DSON preserves supported native values, undefined, NaN/infinities, cycles and shared references **within a document**. Top-level documents are plain objects. Functions, symbols, accessors and unsupported classes/host objects are rejected by the strict codec; this is not a universal JavaScript heap snapshot. Query equality compares Dates by time and binary values by visible bytes. Opaque objects use identity, not recursive structural equality.

## Operations and verification

- `db.stats()` reports revision, storage-entry count, committed bytes, cache use and durability. `storedEntries` includes metadata and indexes; it is not a document count.
- `db.verify()` audits physical records, both directions of declared indexes and the `_collections` entries.
- Directory stores answer full-scan aggregates and counts in worker threads, each over one key range of the same snapshot; `parallel: false` turns them off. [Answer aggregates in worker threads](docs/OPERATIONS.md#answer-aggregates-in-worker-threads)
- Every commit appends copy-on-write pages. The database compacts in the background: without blocking writers after a second without commits, or by queuing writers once the file reaches four times its live size, estimated from its packed size and the stored entries. `autoCompact: false` disables it; `db.compact()` and `db.collect()` remain for manual control. Close long-lived snapshots when finished, because a pinned generation stays on disk. [Reclaim space](docs/OPERATIONS.md#reclaim-space)
- `close()` is idempotent; database and snapshot also implement async disposal. Close active iterators and explicit snapshots when finished. An index-page continuation can resume after reopening the same store if its collection version still matches.

```sh
make setup       # Bun dependencies and Playwright Chromium
make dev         # serve docs, API reference and the Ledger playground at http://127.0.0.1:4380 (PORT)
make site        # regenerate the static docs/ site and validate local links
make bench-workloads # same-backend index, scan and insert measurements on Node and Bun
make bench-mongo     # same-machine comparison with the MongoDB at MONGODB_URL
make bench-runs      # both, in 8 runs (RUNS); keeps the least disturbed run per workload for the website
make bench-search    # lexical, vector and hybrid queries
make verify          # typecheck, lint, tests, coverage, packaged consumers, Chromium OPFS and every site page
make release         # complete source ZIP and installable package
```

See [API](docs/API.md), [architecture](ARCH.md), [operations](docs/OPERATIONS.md), [validation](docs/VALIDATION.md), and [performance](docs/PERFORMANCE.md). Apart from the optional MongoDB comparison at `MONGODB_URL`, no database server, public service or credentials are needed. Data is not encrypted; filesystem/origin access defines the trust boundary.
