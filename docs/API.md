# API reference

## Historical collections

Use `await db.ensureCollection<T>(name, { $trackHistory: true })`. Calls on `collection.at(date)` share an effective instant. Add `{ $asOfRevision: receipt.revision }` to reproduce the database's earlier answer. `history(id)` lists effective segments and `audit(id)` lists recorded changes. [API, correction boundaries, search and backup](HISTORY.md)

## Timestamps

`await db.ensureCollection<Timestamped<T>>(name, { $timestamps: true })` makes every write set `_createdAt` and `_updatedAt` as Dates. Use `Timestamped<T>` from the package as the document type; it removes both fields from the insert and patch types. A document type that keeps its own `_createdAt` in an ordinary collection still writes it. One transaction stamps all its documents with one time. In a tracked collection that time is the history clock, so `_updatedAt` equals the `from` of the version the write records. `_createdAt` survives updates, replacements and `restore()`. `_updatedAt` never moves back for one document, even after a write from a host whose clock ran ahead. Indexes may name both fields; an ordered index on `_updatedAt` stays current under patches that do not name it.

Callers omit both fields or pass their stored values unchanged, so a read document can go back through `put()`. Other values raise `INVALID_DOCUMENT`. Timestamped collections take current writes only; `at(date).put()` raises `HISTORY_READ_ONLY`, because a backdated version would leave the stamps of later versions wrong. The setting is persistent; `$timestamps: false` on a timestamped collection raises `SCHEMA_MISMATCH`.

Turning timestamps on for a collection that holds documents stamps them in batches of up to 128 per transaction, with the time of their batch, since their creation time is unknown. A document that already holds both fields as Dates, `_createdAt` not after `_updatedAt`, keeps them; one that holds only a valid `_createdAt` Date, or the pair in the wrong order, keeps its `_createdAt`. Writes between batches stamp themselves. An interrupted pass keeps a cursor; the next `ensureCollection` with `$timestamps: true`, from any process, resumes it, and once it has finished the call reads one key. Stamping runs before history activation, so the baseline seeds stamped documents. Archive imports keep the stamps they carry. VERIFIED: tests/timestamps.test.ts.

DSON stores a Date in 17 bytes, as many as an epoch-millisecond number. Dates work in ordered indexes, range filters, `min`/`max`, `dateTrunc` and `datePart`. For durations, `q.epochMs` turns a Date into epoch milliseconds: `q.sub(q.epochMs(q.field('_updatedAt')), q.epochMs(q.field('_createdAt')))` is the time between a document's creation and its last write, and `avg`, `max` or `percentile` over it aggregate durations. `sub` on two Dates still raises a TypeError, so a forgotten `epochMs` never gives `NaN`.


All methods use the same APIs on memory, files and OPFS. See generated `.d.mts`/`.d.cts` declarations for exact generic result inference.

## Opening

| Function | Entry | Arguments |
| --- | --- | --- |
| `openMemory` | `defuss-db` | `OpenOptions?` |
| `openDatabase` | `defuss-db` | Coordinated DBSONL `Backend`, `OpenOptions?` |
| `openDirectory` | `defuss-db/server` | Root path, `OpenOptions & { storage?: FileBackendOptions; parallel?: boolean \| ParallelOptions }` |
| `openOPFS` | `defuss-db/browser` | `OpenOptions & { namespace?: string; storage?: OPFSStorageOptions without name }` |

`OpenOptions`: `name` (default `default`), `create` (default `true`), `signal`, `queryCache` (automatic by default; false or cache configuration), `autoCompact` (on by default; false or `{ minBytes, growth, idleMs }`, see [operations](OPERATIONS.md#reclaim-space)), and DBSONL resource options. Existing storage opens with `create: false`. Logical database names follow DBSONL's lowercase 1–64-character name grammar. Collection/index names match `[A-Za-z][A-Za-z0-9_-]{0,63}`.

| Storage limit | Default |
| --- | ---: |
| `maxRecordBytes` | 16 MiB |
| `maxTransactionBytes` | 64 MiB |
| `maxTransactionOperations` | 10,000 |
| `maxPendingOperations` | 256 |
| `maxPendingBytes` | 128 MiB |
| `maxCacheBytes` | 64 MiB, counted in encoded page bytes; with DBSONL's compact pages `maxCachePages` (16,384) binds first; a cached page measured about 2 KiB of heap. Document values are not cached. DBSONL 0.9 also holds up to `maxCachePages` index pages of commits since its last checkpoint in memory |
| `maxCachePages` | 16,384 |

Operation counts include physical schema/index entries, not just documents. For example, a document plus two indexes consumes three distinct staged keys; each changed collection consumes one revision key per transaction, and initial schema creation consumes another. The underlying engine additionally checks encoded framing sizes. Index builds can need one entry per indexed document plus metadata.

Server `storage.io` accepts the Storage adapter's optional synchronous read mode; it can help dedicated database workers but can block the application's event loop. The default keeps the upstream asynchronous mode. `parallel` controls the query worker threads that answer mergeable full-scan aggregates and counts together. They are on by default; `false` turns them off, and `{ workers, minRows }` sets them, with `workers` default one fewer than the CPUs, at most 8, and `minRows` (documents the collection must hold) default 1,000. See [Answer aggregates in worker threads](OPERATIONS.md#answer-aggregates-in-worker-threads). `storage` also takes DBSONL's scan pool and read options: `scanWorkers` (worker threads for large scans; default up to 4, one fewer than the CPUs; 0 turns the pool off), `scanThreshold` (rows a scan must cover before it runs in the pool; default 5,000) and `syncReadBytes` (reads up to this size are blocking calls; default 16 KiB; 0 sends every read through the thread pool, for network or slow storage). Memory factories reuse the same serialized storage path, not a special object-map database.

## Database

| Method | Result / behavior |
| --- | --- |
| `collection<T>(name)` | Typed live collection; no I/O merely to obtain it |
| `ensureCollection<T>(name, options?)` | Persist `$trackHistory` and `$timestamps`, then return the collection; idempotent, and both settings are permanent |
| `collections()` | Persisted collection names, including now-empty collections |
| `transaction(callback, options?)` | `{ result, revision, storedEntries }`; callback runs once |
| `snapshot()` | Read-only `DatabaseSnapshot`, with `revision`, `collection<T>`, `close` |
| `export(options?)` | `Uint8Array` Brotli archive; buffered, default 64 MiB compressed cap |
| `exportStream(options?)` | Pull-driven `AsyncGenerator<Uint8Array>` holding one snapshot |
| `import(input, options?)` | Atomic archive import and index rebuild; receipt with counts/revisions |
| `queryCacheStats()` | Result/plan/pending counters and accounted bytes, or undefined when disabled |
| `clearQueryCache()` | Clear results/history/plans and invalidate in-flight admissions |
| `stats()` | DBSONL metadata; `storedEntries` includes documents, schemas, indexes and marker; `autoCompaction` holds `state`, `runs`, `conflicts`, `failures` and `reclaimedBytes`; on directory stores, `parallel` holds `state` (`idle`, `starting`, `ready`, `failed`, `closed`), `workers`, `minRows`, `queries`, `fallbacks`, `starts` and, after a failed start, `error` |
| `verify()` | `{ revision, documents, indexEntries, collections }` after physical and logical audit |
| `compact(options?)` | Delegated DBSONL compaction; default optimistic, or `{ mode: 'exclusive' }` |
| `collect()` | Delegated reclamation of unpinned generations |
| `close()` | Idempotent close; database and snapshots support `Symbol.asyncDispose` |

Write options accept `ifRevision` for whole-store compare-and-swap and `signal`. Revisions are database-wide, not per collection. A transaction object exposes `revision` and `collection<T>`. A transaction collection has the same read APIs and the mutation APIs below, without an independent commit option.

## Collection mutations

| Method | Semantics / result |
| --- | --- |
| `insert(document, options?)` | Reject existing ID; return ID; omitted ID generates UUID |
| `insertMany(documents, options?)` | One atomic bounded batch; return IDs |
| `insertBatches(iterable, options?)` | Async generator of `{ ids, revision, storedEntries }`; one atomic commit per input batch |
| `put(document, options?)` | Insert or replace whole document with required ID; return ID |
| `update(id, patchOrCallback, options?)` | Shallow own-property patch or complete replacement callback; return whether ID existed |
| `delete(id, options?)` | Return whether ID existed |
| `restore(id, options?)` | Tracked collections: write back the version a delete removed as a new version; return false if the document is live or was never deleted |
| `updateMany(request, patchOrCallback, options?)` | Atomic bounded set update; return affected document count |
| `deleteMany(request?, options?)` | Atomic bounded set deletion; return affected document count |
| `createIndex(definition, options?)` | Atomic equality or ordered build. Set `order` to one direction per field. An identical declaration is idempotent; mismatched existing name rejects |
| `createSearchIndex(definition, options?)` | Atomic lexical/vector/hybrid build; see [Search](SEARCH.md) |
| `dropSearchIndex(name, options?)` | Atomic removal of search inputs, state and definition |
| `dropIndex(name, options?)` | Atomic removal; return whether it existed |

`updateMany`/`deleteMany` accept DataView query resource options alongside write options. Their collected output caps cannot exceed the transaction limits. A callback update can be asynchronous; it executes once, receives the current decoded document, and must preserve its typed ID. Patches cannot contain `id`. Upsert-by-ID is `put`; there is no ambiguous selector-based upsert.

`IndexDefinition`: `{ name, fields: string[], unique?: boolean }`. Unique indexes treat missing/undefined and null as distinct values, each allowed at most once for a given compound tuple. Ordinary objects/arrays/Maps/Sets cannot be index components. No prefix/range index use is claimed.

## Collection reads

| Method | Result |
| --- | --- |
| `get(id)` | Document or `undefined` |
| `getMany(ids, { signal }?)` | Ordered documents/undefined; duplicate IDs preserved; one snapshot; at most 100,000 IDs |
| `searchIndexes()` | Persisted search definitions |
| `search(index, query, options?)` | Revision-bound scored hits; see [Search](SEARCH.md) |
| `has(id)` | Boolean |
| `find(request?, options?)` | Document array |
| `findOne(request?, options?)` | First matching document or `undefined`; effective limit is one |
| `query(request?, options?)` | `{ rows, summary }` |
| `pageIdsByIndex(index, options?)` | Keyset page of typed primary IDs. Returns `{ rows, nextCursor, revision }`. Accepts document-page cursors for the same scope and range. |
| `countByIndex(index, options?)` | Exact number of ordered index entries matching `prefix` and bounds. Optional `maxScannedEntries` rejects excessive work. Accepts an abort signal. |
| `pageByIndex(index, options?)` | Seek page of documents with `rows`, `nextCursor` and snapshot `revision`. [Cursor contract](ORDERED.md) |
| `stream(request?, options?)` | DataView `batch` / `complete` events |
| `count(selection?, options?)` | Exact count of matching documents |
| `select(descriptor, page?, options?)` | Typed projected rows and summary |
| `aggregate(descriptor, page?, options?)` | Typed grouped/scalar rows and summary |
| `view(descriptor, page?, options?)` | Typed projected rows, totals and summary |
| `prepareFind/Select/Aggregate/View` | Bound prepared plan: `evaluate`, `stream`, `explain` |
| `explain(request?)` | `{ revision, access, query }`; access selection for the inspected snapshot |
| `source()` | Document-level DataView `RecordSource<T>` |
| `indexes()` | Fresh persisted equality and ordered definitions |
| `q` | DataView `forRows<T>()` builders and plan factories |

`FindRequest`: `filters`, `where`, `semantics`, `sorters`, `offset`, `limit`, `numberMode`, `invalidNumbers`, `access: 'auto' | 'scan'`. Filters support `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `contains`, `startsWith`, `endsWith`. Filters are ANDed. `where` uses `q.and`, `q.or`, `q.not`, comparisons, arithmetic and nullish tests. Query fields use DataView's safe own-property rules, not prototype traversal. A `prepareFind` plan captures its default page; passing a page to `evaluate` replaces that default page.

Projection descriptors contain `select: { alias: Expr }`, optional `filters/where`, and `orderBy: [{ expr, direction }]`. Aggregate descriptors contain optional `groupBy`, required `measures`, optional `having` over result aliases, and output-alias `orderBy`. View descriptors contain `select`, `totals` and row-expression ordering. These are DataView descriptors, not a separate SQL dialect.

Expressions include calendar buckets (`dateTrunc`, `datePart`, in UTC or an IANA time zone), text (`lower`, `upper`, `trim`, `substring`, `concat`, `length`), `cond` and rounding (`floor`, `ceil`, `round`, `abs`). The group key `each(expr)` unwinds arrays: a document joins one group per distinct element and none for an empty array. Measures are `count`, `sum`, `avg`, `min`, `max`, `sumBigInt`, `countDistinct`, `distinct`, `percentile` and `median`; each takes an optional `where`. Query workers answer a full-scan aggregate when every measure merges: all of them do except `sum` and `avg` outside `numberMode: 'exact'`. DataView's COMPUTE_SEMANTICS.md defines each result, including time zone transitions and percentile interpolation.

There is no join. To combine collections, read them in one `db.snapshot()`: aggregate one collection, then fetch the documents its group keys name with `getMany` on the other. VERIFIED: both reads see the same revision, and the second reads only the documents the groups name (tests/database.test.ts 'aggregates one collection and reads another by its group keys in one snapshot').

```ts
const snapshot = await db.snapshot();
try {
  const orders = snapshot.collection<Order>('orders'), q = orders.q;
  const totals = await orders.aggregate({
    groupBy: { customer: q.field('customer') }, // a customer ID
    measures: { revenue: q.sum(q.field('amount')) },
    orderBy: [{ field: 'revenue', direction: 'desc' }],
  }, { limit: 10 });
  const customers = await snapshot.collection<Customer>('customers')
    .getMany(totals.rows.map((row) => row.customer)); // in the order of totals.rows
} finally {
  await snapshot.close();
}
```

`ComputeOptions`: `count`, `batchSize`, `maxBatchBytes`, `maxRowBytes`, `maxScannedRows`, `maxWorkingBytes`, `maxGroups`, `maxOutputRows`, `maxOutputBytes`, `yieldEveryBatches`, `profile`, `sizeOf`, `sizeOfOutput`, `signal`. Custom `sizeOf` sees public documents. Custom `sizeOfOutput` sees actual public output rows, including whole documents for `find/query/stream`. Estimators must be pure and stable; they account memory and do not serialize values.

Default grouping/working-state capacity is 64 MiB and 100,000 groups; collected output is limited to 100,000 rows and 64 MiB. Use streaming for larger row output and explicit budgets for large sorts/groups. Streaming does not make an unbounded sort or grouping bounded without a cap.

Summary fields are DataView's `ComputeSummary`. `revision` identifies the snapshot; `scannedRows` counts candidate documents seen by the query executor. `sourceRows` describes the candidate source, not necessarily the entire collection. `totalInputMatches` and `totalResultRows` may be `null` if execution legitimately stops early; `count: 'exact'` requires exact result totals. `hasMore`, `sourceExhausted`, strategy and peak accounting remain explicit. A failed/cancelled stream does not emit a successful complete event; earlier batches may already have been consumed.

Default ordering without `sorters/orderBy` follows typed storage keys. It is not insertion order or numeric ID order. Specify a deterministic tie-breaker such as `id` when pagination needs an explicit order. Use `pageByIndex` for keyset traversal in declared index order, including the storage-ID tie-breaker.

`explain().access.kind` can be `scan`, `primary`, `primary-in`, `equality`, `range` or `ordered`. Ordered/range plans expose the index name, length of the fixed equality prefix, and range field when present. `primary-in` and bounded `range` plans report their point-key count. Explaining a bounded range may probe index pointers.

## MongoDB syntax and schemas

`defuss-db/mongo` is a separate entry, so an application that never reads MongoDB syntax never loads it. Every function takes any collection: a `Collection`, a `ReadCollection` bound with `at(date)` or a `TransactionCollection`.

| Function | Result |
| --- | --- |
| `findMongo(collection, filter?, { sort, projection, skip, limit }?)` | Projected documents. Each document argument is an object or its text. |
| `aggregateMongo(collection, pipeline)` | MongoDB's result documents: `{ _id, ...accumulators }`, or `[{ [name]: n }]` for `$count` (none when nothing matched). |
| `mongoRequest(q, filter?, sort?)` | `{ filters, where?, sorters? }` for `find`, `query`, `count` or `explain`. |
| `translatePipeline(stages)` / `aggregateDescriptor(plan, q)` | The plan of a pipeline (match, keys, measures, sort, limit) / its aggregate descriptor. |
| `parseDocument(text, what?)`, `parsePipeline(text)` | Shell or Extended JSON text as values: `ISODate()` and `{ $date }` become a Date, `NumberLong()` and `{ $numberLong }` a BigInt. |
| `stringify(value, space?)`, `revive(value)` | Values as Extended JSON text and back. |
| `translateFilter(doc, q)`, `translateSort(doc)`, `project(doc, projection)` | The parts of `findMongo`. |

Filters: `$eq $ne $gt $gte $lt $lte $in` on a top-level field become `filters`, which an index answers; `$nin $exists $not`, conditions on a dot path, `$and $or $nor` become one `where` expression. `$regex` accepts `^prefix`, `suffix$` or plain text on a top-level field. A projection includes or excludes fields (dot paths too); the id stays unless `{ id: 0 }`.

Matching follows MongoDB's rules: `null` matches a null or missing field, `$exists` tells them apart, and a comparison matches only values of its operand's type, so `{ $gt: 4 }` matches no string or Date. The type rule adds one bound to the range, which an ordered index still answers. VERIFIED: tests/mongo.test.ts holds the ids MongoDB 9.0.8 returned for the same documents and filters. Two rules differ from MongoDB. An array field compares as one value, so `{ tags: 'a' }` does not match `['a', 'b']`; group by its elements with `$unwind`. A sort puts null and missing values last in ascending order, where MongoDB puts them first. BigInts (`NumberLong`) and numbers never compare equal.

Pipelines: `$match` (several are ANDed), `$unwind` (only as a group key: one group per element), `$group` (`_id`: a field, a document of fields, `$toLower`, `$toUpper`, `$year`, `$dateTrunc`, `$dateToString` with `%Y`, `%Y-%m`, `%Y-%m-%d` or `%Y-%m-%dT%H`, both with an optional IANA `timezone`, and weeks only with `startOfWeek: 'monday'`, since MongoDB's weeks otherwise start on Sunday; `$sum`, `$count`, `$avg`, `$min`, `$max`, `$addToSet`), `$size` of an `$addToSet` in `$set` / `$addFields` / `$project`, `$sort` by one key or accumulator, `$limit` and the `$count` stage. Any other stage or operator throws a `QueryError` naming the stage.

`analyzeSchema(collection, { sample, at, $asOfRevision, maxDepth, examples, title }?)` (main entry) answers `{ schema, sampled, total, at }`. It reads at most `sample` documents (default 1,000): all of a smaller collection, else eight windows at even offsets, since default order follows storage keys and ids often follow insertion time. With `at` it reads the collection as it was then; a collection without history throws `HISTORY_NOT_ENABLED`. `inferSchema(docs, options?)` is the same inference over documents you hold. The schema is JSON Schema draft 2020-12: `type`, `properties`, `required` (properties every sampled object holds), `items`, `anyOf` where one place holds an object or array beside other types, and `examples` (up to three distinct scalars). A property some objects lack carries `x-presence`, the share that hold it. DSON values keep a JSON type and name their own in `x-dson`: a Date is `{ type: 'string', format: 'date-time', 'x-dson': 'date' }`, a BigInt an integer, binary a base64 string, a Map an object of `additionalProperties`, a Set an array of `uniqueItems`. A value that contains itself is a `$comment`, not an endless schema.

## Errors

`DatabaseError` codes: `DUPLICATE_KEY`, `SCHEMA_MISMATCH`, `INVALID_DOCUMENT`, `INVALID_INDEX_VALUE`, `CORRUPT`, `INVALID_CURSOR`, `STALE_CURSOR`, `CLOSED`, `BUSY`, `UNFINISHED_TRANSACTION`, and for history `HISTORY_ACTIVATING`, `HISTORY_NOT_ENABLED`, `HISTORY_UNAVAILABLE`, `HISTORY_READ_ONLY`, `HISTORY_FUTURE_WRITE`, `HISTORY_RANGE`. Input validation can also throw `TypeError`/`RangeError`; strict DSON errors remain intact.

DBSONL errors (`CONFLICT`, `COMMIT_UNCERTAIN`, `LIMIT_EXCEEDED`, `QUEUE_FULL`, `ABORTED`, corruption etc.), DataView errors, and Storage errors retain their original codes/causes. `COMMIT_UNCERTAIN` means publication status must be inspected before retrying; never blindly retry non-idempotent writes. Capacity limits, unsupported platforms and browser quota errors fail explicitly. Nothing silently downgrades durability or repairs corruption.

## Archives and result caching

See [Archive API](ARCHIVE.md) for options, framing, budgets and merge behavior. Explicit snapshots support both export methods, but no import. See [Query cache](CACHE.md) for default automatic qualification, `{ cache: false | true | 'auto' | 'refresh' }`, manual mode, LRU/SLRU settings, bounded compiled plans, concurrent misses, independent result ownership and revision keys.
